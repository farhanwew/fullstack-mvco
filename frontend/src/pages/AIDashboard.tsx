//AIDashboard.tsx
import React, { useState, useEffect } from 'react';
import { fastApiService } from '@/services/fastapi.service';
import { useAuth } from '@/hooks/useAuth';
import { COLORS, ICONS } from '@/utils/constants';

interface ModelConfig {
  name: string;
  displayName: string;
  icon: React.ReactNode;
  description: string;
  features: string[];
}

const MODELS: ModelConfig[] = [
  {
    name: 'weather',
    displayName: 'Weather Prediction',
    icon: <ICONS.WEATHER.CLEAR size={24} />,
    description: 'Predict weather conditions for mining operations',
    features: ['Temperature_C', 'Humidity_Percent', 'Rainfall_mm', 'Wind_Speed_mps', 'Weather_Condition']
  },
  {
    name: 'road',
    displayName: 'Road Condition',
    icon: <ICONS.ROAD.GOOD size={24} />,
    description: 'Predict road conditions and accessibility',
    features: ['Surface_Type', 'Surface_Condition', 'Traffic_Density', 'Flood_Level_m', 'Access_Status']
  },
  {
    name: 'equipment',
    displayName: 'Equipment Health',
    icon: <ICONS.TRANSPORT.TRUCK size={24} />,
    description: 'Predict equipment maintenance needs and failures',
    features: ['Machine_Type', 'Engine_Temperature_C', 'Fuel_Level_Percent', 'Maintenance_Status', 'Working_Hours']
  },
  {
    name: 'vessel',
    displayName: 'Vessel Performance',
    icon: <ICONS.TRANSPORT.SHIP size={24} />,
    description: 'Predict vessel delays and performance',
    features: ['Delay_Minutes', 'Cargo_Type', 'Load_Weight_Tons', 'Port_Condition', 'Sea_Condition_Code']
  },
  {
    name: 'logistics',
    displayName: 'Logistics Optimization',
    icon: <ICONS.SCHEDULE size={24} />,
    description: 'Predict logistics delays and optimize routes',
    features: ['Cargo_Type', 'Distance_km', 'Travel_Time_hr', 'Delivery_Status', 'CO2_Emission_kg']
  },
  {
    name: 'production',
    displayName: 'Production Efficiency',
    icon: <ICONS.ORDER size={24} />,
    description: 'Predict production output and efficiency',
    features: ['Material_Type', 'Production_Tons', 'Fuel_Consumed_Liters', 'Equipment_Efficiency_Percent', 'Downtime_Minutes']
  }
];

interface PredictionResult {
  timestamp: string;
  model: string;
  prediction: any;
  probabilities: Record<string, number>;
  inputs_used: Record<string, any>;
}

interface Recommendation {
  primary: Array<{action: string; justification: string; expected_impact: string}>;
  alternative: Array<{action: string; justification: string; expected_impact: string}>;
  mitigation: Array<{action: string; justification: string; expected_impact: string}>;
}

interface EmailSummary {
  subject: string;
  body: string;
}

const AIDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedModel, setSelectedModel] = useState<string>('weather');
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [emailSummary, setEmailSummary] = useState<EmailSummary | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: string; content: string}>>([]);
  const [testData, setTestData] = useState<Record<string, any>>({});

  const currentModel = MODELS.find(m => m.name === selectedModel);

  useEffect(() => {
    // Load test data for selected model
    const loadTestData = async () => {
      try {
        const data = await fastApiService.testModel(selectedModel);
        setTestData(data);
        
        // Initialize input values with test data
        const initialValues: Record<string, any> = {};
        if (currentModel) {
          currentModel.features.forEach(feature => {
            initialValues[feature] = data[feature] || '';
          });
        }
        setInputValues(initialValues);
      } catch (error) {
        console.error('Failed to load test data:', error);
      }
    };

    loadTestData();
  }, [selectedModel]);

  const handleInputChange = (feature: string, value: any) => {
    setInputValues(prev => ({
      ...prev,
      [feature]: value
    }));
  };

  const handlePredict = async () => {
    if (!currentModel) return;

    setIsLoading(true);
    try {
      // Make prediction
      const prediction = await fastApiService.predict(selectedModel, inputValues);
      setPredictionResult(prediction);

      // Sort probabilities
      const probabilities = prediction.probabilities || {};
      const sortedLabels = Object.entries(probabilities)
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label);

      // Get recommendation
      const rec = await fastApiService.getRecommendation(
        selectedModel,
        prediction.prediction,
        probabilities,
        sortedLabels,
        inputValues
      );
      setRecommendation(rec);

      // Get email summary
      const summaryRecord = {
        model: selectedModel,
        prediction: prediction.prediction,
        probabilities: probabilities,
        recommendations: rec,
        timestamp: prediction.timestamp
      };
      const email = await fastApiService.getEmailSummary(summaryRecord);
      setEmailSummary(email);

    } catch (error) {
      console.error('Prediction failed:', error);
      alert('Prediction failed. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAllModels = async () => {
    setIsLoading(true);
    try {
      const results = await fastApiService.testAllModels();
      console.log('Test all results:', results);
      alert('All models tested successfully! Check console for details.');
    } catch (error) {
      console.error('Test all failed:', error);
      alert('Failed to test all models.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage;
    setChatMessage('');
    setIsChatLoading(true);

    // 1. Add User Message
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // 2. Add Placeholder Assistant Message
    setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      let fullResponse = "";
      
      await fastApiService.streamChat(userMessage, (chunk) => {
        fullResponse += chunk;
        setChatHistory(prev => {
          const newHistory = [...prev];
          const lastIdx = newHistory.length - 1;
          // Ensure we are updating the assistant's message
          if (newHistory[lastIdx].role === 'assistant') {
            newHistory[lastIdx] = { 
              ...newHistory[lastIdx], 
              content: fullResponse 
            };
          }
          return newHistory;
        });
      });
      
      setChatResponse(fullResponse);

    } catch (error) {
      console.error('Chat failed:', error);
      setChatResponse('Error: Failed to get response from AI.');
      setChatHistory(prev => {
         const newHistory = [...prev];
         const lastIdx = newHistory.length - 1;
         newHistory[lastIdx] = { role: 'assistant', content: 'Error: Failed to get response from AI.' };
         return newHistory;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUseTestData = () => {
    if (testData) {
      setInputValues(testData);
    }
  };

  const renderInputField = (feature: string) => {
    const value = inputValues[feature] || '';
    
    if (feature.includes('Condition') || feature.includes('Status') || 
        feature.includes('Type') || feature.includes('Mode')) {
      return (
        <select
          value={value}
          onChange={(e) => handleInputChange(feature, e.target.value)}
          className="input-field"
        >
          <option value="">Select...</option>
          <option value="Good">Good</option>
          <option value="Moderate">Moderate</option>
          <option value="Poor">Poor</option>
          <option value="Clear">Clear</option>
          <option value="Rainy">Rainy</option>
          <option value="Storm">Storm</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
      );
    }

    return (
      <input
        type="number"
        value={value}
        onChange={(e) => handleInputChange(feature, parseFloat(e.target.value) || 0)}
        className="input-field"
        placeholder={`Enter ${feature}`}
        step="0.1"
      />
    );
  };

  return (
    <div className="ai-dashboard">
      <div className="dashboard-header">
        <h1>AI Prediction & Recommendation Dashboard</h1>
        <p>Smart predictions and recommendations for mining operations</p>
      </div>

      <div className="dashboard-content">
        {/* Left Column - Model Selection & Input */}
        <div className="left-column">
          {/* Model Selection */}
          <div className="model-selection-section">
            <h2>Select Model</h2>
            <div className="model-grid">
              {MODELS.map(model => (
                <button
                  key={model.name}
                  className={`model-card ${selectedModel === model.name ? 'active' : ''}`}
                  onClick={() => setSelectedModel(model.name)}
                >
                  <div className="model-icon">
                    {model.icon}
                  </div>
                  <div className="model-info">
                    <h3>{model.displayName}</h3>
                    <p>{model.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          {currentModel && (
            <div className="input-form-section">
              <div className="section-header">
                <h2>Input Parameters for {currentModel.displayName}</h2>
                <button
                  onClick={handleUseTestData}
                  className="btn btn-secondary"
                >
                  Use Test Data
                </button>
              </div>
              
              <div className="input-grid">
                {currentModel.features.map(feature => (
                  <div key={feature} className="input-group">
                    <label>{feature.replace(/_/g, ' ')}</label>
                    {renderInputField(feature)}
                  </div>
                ))}
              </div>

              <div className="action-buttons">
                <button
                  onClick={handlePredict}
                  disabled={isLoading}
                  className="btn btn-primary predict-btn"
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Predicting...
                    </>
                  ) : (
                    'Run Prediction'
                  )}
                </button>
                
                <button
                  onClick={handleTestAllModels}
                  disabled={isLoading}
                  className="btn btn-outline"
                >
                  Test All Models
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results & Chat */}
        <div className="right-column">
          {/* Prediction Results */}
          {predictionResult && (
            <div className="results-section">
              <h2>Prediction Results</h2>
              <div className="result-card">
                <div className="result-header">
                  <h3>{predictionResult.model.toUpperCase()} Model</h3>
                  <span className="timestamp">{predictionResult.timestamp}</span>
                </div>
                
                <div className="prediction-display">
                  <div className="prediction-value">
                    <span className="label">Prediction:</span>
                    <span className="value">{String(predictionResult.prediction)}</span>
                  </div>
                  
                  {predictionResult.probabilities && (
                    <div className="probabilities">
                      <h4>Confidence Scores:</h4>
                      <div className="probability-bars">
                        {Object.entries(predictionResult.probabilities).map(([label, score]) => (
                          <div key={label} className="probability-item">
                            <span className="label">{label}:</span>
                            <div className="bar-container">
                              <div 
                                className="bar" 
                                style={{ width: `${score * 100}%` }}
                              ></div>
                              <span className="percentage">{(score * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendation && !recommendation.error && (
            <div className="recommendations-section">
              <h2>AI Recommendations</h2>
              <div className="recommendation-tabs">
                <div className="tab active">Primary Actions</div>
                <div className="tab">Alternative</div>
                <div className="tab">Mitigation</div>
              </div>
              
              <div className="recommendations-list">
                {recommendation.primary?.map((item, index) => (
                  <div key={index} className="recommendation-item">
                    <div className="recommendation-header">
                      <span className="number">{index + 1}</span>
                      <h4>{item.action}</h4>
                    </div>
                    <p className="justification">{item.justification}</p>
                    <div className="expected-impact">
                      <strong>Expected Impact:</strong> {item.expected_impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Summary */}
          {emailSummary && !emailSummary.error && (
            <div className="email-section">
              <h2>Email Summary</h2>
              <div className="email-card">
                <div className="email-header">
                  <h3>{emailSummary.subject}</h3>
                </div>
                <div className="email-body">
                  <pre>{emailSummary.body}</pre>
                </div>
                <div className="email-actions">
                  <button className="btn btn-outline">Copy to Clipboard</button>
                  <button className="btn btn-primary">Send Email</button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Box */}
          <div className="chat-section">
            <h2>AI Assistant Chat</h2>
            <div className="chat-container">
              <div className="chat-messages">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`message ${msg.role}`}>
                    <div className="message-content">
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="message assistant">
                    <div className="message-content typing">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="chat-input">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask AI assistant about predictions, recommendations, or mining operations..."
                  disabled={isChatLoading}
                />
                <button
                  onClick={handleSendChat}
                  disabled={isChatLoading || !chatMessage.trim()}
                  className="send-btn"
                >
                  <ICONS.ACTIONS.SEND size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ai-dashboard {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        
        .dashboard-header {
          margin-bottom: 32px;
        }
        
        .dashboard-header h1 {
          margin: 0 0 8px 0;
          color: ${COLORS.text};
          font-size: 28px;
          font-weight: 700;
        }
        
        .dashboard-header p {
          margin: 0;
          color: ${COLORS.textLight};
          font-size: 16px;
        }
        
        .dashboard-content {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 24px;
        }
        
        @media (max-width: 1024px) {
          .dashboard-content {
            grid-template-columns: 1fr;
          }
        }
        
        /* Left Column Styles */
        .left-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .model-selection-section {
          background: ${COLORS.background};
          border: 1px solid ${COLORS.border};
          border-radius: 12px;
          padding: 24px;
        }
        
        .model-selection-section h2 {
          margin: 0 0 20px 0;
          color: ${COLORS.text};
          font-size: 20px;
          font-weight: 600;
        }
        
        .model-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        
        .model-card {
          background: ${COLORS.backgroundSecondary};
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .model-card:hover {
          border-color: ${COLORS.primary};
          transform: translateY(-2px);
        }
        
        .model-card.active {
          border-color: ${COLORS.primary};
          background: rgba(106, 63, 181, 0.05);
        }
        
        .model-icon {
          color: ${COLORS.primary};
          margin-bottom: 12px;
        }
        
        .model-info h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
          color: ${COLORS.text};
        }
        
        .model-info p {
          margin: 0;
          font-size: 12px;
          color: ${COLORS.textLight};
          line-height: 1.4;
        }
        
        .input-form-section {
          background: ${COLORS.background};
          border: 1px solid ${COLORS.border};
          border-radius: 12px;
          padding: 24px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .input-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .input-group label {
          font-size: 12px;
          color: ${COLORS.text};
          font-weight: 500;
          text-transform: capitalize;
        }
        
        .input-field {
          padding: 8px 12px;
          border: 1px solid ${COLORS.border};
          border-radius: 6px;
          font-size: 14px;
          color: ${COLORS.text};
          background: ${COLORS.background};
          transition: border-color 0.2s;
        }
        
        .input-field:focus {
          outline: none;
          border-color: ${COLORS.primary};
          box-shadow: 0 0 0 3px rgba(106, 63, 181, 0.1);
        }
        
        .action-buttons {
          display: flex;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid ${COLORS.border};
        }
        
        .predict-btn {
          flex: 2;
        }
        
        /* Right Column Styles */
        .right-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .results-section,
        .recommendations-section,
        .email-section,
        .chat-section {
          background: ${COLORS.background};
          border: 1px solid ${COLORS.border};
          border-radius: 12px;
          padding: 24px;
        }
        
        h2 {
          margin: 0 0 20px 0;
          color: ${COLORS.text};
          font-size: 20px;
          font-weight: 600;
        }
        
        .result-card {
          background: ${COLORS.backgroundSecondary};
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          padding: 20px;
        }
        
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid ${COLORS.border};
        }
        
        .result-header h3 {
          margin: 0;
          font-size: 16px;
          color: ${COLORS.primary};
        }
        
        .timestamp {
          font-size: 12px;
          color: ${COLORS.textLight};
        }
        
        .prediction-display {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .prediction-value {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .prediction-value .label {
          font-weight: 600;
          color: ${COLORS.text};
        }
        
        .prediction-value .value {
          padding: 8px 16px;
          background: ${COLORS.primary};
          color: white;
          border-radius: 20px;
          font-weight: 600;
        }
        
        .probabilities h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: ${COLORS.text};
        }
        
        .probability-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .probability-item .label {
          min-width: 80px;
          font-size: 12px;
          color: ${COLORS.text};
        }
        
        .bar-container {
          flex: 1;
          height: 20px;
          background: ${COLORS.background};
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }
        
        .bar {
          height: 100%;
          background: ${COLORS.primary};
          border-radius: 10px;
          transition: width 0.3s ease;
        }
        
        .percentage {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          color: ${COLORS.text};
          font-weight: 600;
        }
        
        .recommendation-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          padding: 4px;
          background: ${COLORS.backgroundSecondary};
          border-radius: 8px;
        }
        
        .tab {
          flex: 1;
          padding: 8px 16px;
          text-align: center;
          cursor: pointer;
          border-radius: 6px;
          font-size: 14px;
          color: ${COLORS.textLight};
          transition: all 0.2s;
        }
        
        .tab.active {
          background: white;
          color: ${COLORS.primary};
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .recommendation-item {
          background: ${COLORS.backgroundSecondary};
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          padding: 16px;
        }
        
        .recommendation-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .recommendation-header .number {
          width: 24px;
          height: 24px;
          background: ${COLORS.primary};
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        
        .recommendation-header h4 {
          margin: 0;
          font-size: 14px;
          color: ${COLORS.text};
          font-weight: 600;
        }
        
        .justification {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: ${COLORS.text};
          line-height: 1.4;
        }
        
        .expected-impact {
          font-size: 13px;
          color: ${COLORS.textLight};
          padding-top: 8px;
          border-top: 1px solid ${COLORS.border};
        }
        
        .email-card {
          background: ${COLORS.backgroundSecondary};
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          overflow: hidden;
        }
        
        .email-header {
          padding: 16px;
          background: ${COLORS.primary};
          color: white;
        }
        
        .email-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .email-body {
          padding: 16px;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .email-body pre {
          margin: 0;
          font-family: inherit;
          font-size: 13px;
          color: ${COLORS.text};
          white-space: pre-wrap;
          line-height: 1.5;
        }
        
        .email-actions {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-top: 1px solid ${COLORS.border};
        }
        
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 400px;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          overflow: hidden;
        }
        
        .chat-messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          background: ${COLORS.backgroundSecondary};
        }
        
        .message {
          margin-bottom: 16px;
          display: flex;
        }
        
        .message.user {
          justify-content: flex-end;
        }
        
        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .message.user .message-content {
          background: ${COLORS.primary};
          color: white;
          border-bottom-right-radius: 4px;
        }
        
        .message.assistant .message-content {
          background: white;
          color: ${COLORS.text};
          border: 1px solid ${COLORS.border};
          border-bottom-left-radius: 4px;
        }
        
        .typing {
          display: flex;
          gap: 4px;
          align-items: center;
          height: 20px;
        }
        
        .dot {
          width: 8px;
          height: 8px;
          background: ${COLORS.textLight};
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }
        
        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }
        
        .chat-input {
          display: flex;
          gap: 8px;
          padding: 16px;
          background: white;
          border-top: 1px solid ${COLORS.border};
        }
        
        .chat-input input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid ${COLORS.border};
          border-radius: 24px;
          font-size: 14px;
          color: ${COLORS.text};
        }
        
        .chat-input input:focus {
          outline: none;
          border-color: ${COLORS.primary};
        }
        
        .send-btn {
          width: 48px;
          height: 48px;
          background: ${COLORS.primary};
          color: white;
          border: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .send-btn:hover:not(:disabled) {
          background: ${COLORS.primaryDark};
        }
        
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Button Styles */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        
        .btn-primary {
          background: ${COLORS.primary};
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: ${COLORS.primaryDark};
        }
        
        .btn-secondary {
          background: ${COLORS.backgroundSecondary};
          color: ${COLORS.text};
          border-color: ${COLORS.border};
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: ${COLORS.background};
          border-color: ${COLORS.primary};
          color: ${COLORS.primary};
        }
        
        .btn-outline {
          background: transparent;
          border-color: ${COLORS.primary};
          color: ${COLORS.primary};
        }
        
        .btn-outline:hover:not(:disabled) {
          background: ${COLORS.primary};
          color: white;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid white;
          border-right-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .ai-dashboard {
            padding: 16px;
          }
          
          .model-grid {
            grid-template-columns: 1fr;
          }
          
          .input-grid {
            grid-template-columns: 1fr;
          }
          
          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default AIDashboard;
