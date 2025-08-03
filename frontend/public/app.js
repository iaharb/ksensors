// src/App.js
import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SensorList from './components/sensors/SensorList';
import SensorForm from './components/sensors/SensorForm';
import BuildingList from './components/buildings/BuildingList';
import ContactList from './components/contacts/ContactList';
import ReadingList from './components/readings/ReadingList';
import NavBar from './components/NavBar';

function App() {
const [backendStatus, setBackendStatus] = useState('checking...');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await api.get('/health');
        setBackendStatus(response.data.status);
      } catch (error) {
        setBackendStatus(`Error: ${error.message}`);
      }
    };
    
    checkBackend();
  }, []);
  return (
    <Router>
      <div className="App">
        <h1>Sensor Monitoring System</h1>
        <p>Backend status: {backendStatus}</p>
        <p>Backend URL: {process.env.REACT_APP_API_URL}</p>
        <NavBar />
        <div className="content">
          <Routes>
            <Route path="/sensors" element={<SensorList />} />
            <Route path="/sensors/new" element={<SensorForm onSuccess={(msg) => alert(msg)} />} />
            <Route path="/sensors/edit/:id" element={<SensorFormWrapper />} />
            <Route path="/buildings" element={<BuildingList />} />
            <Route path="/contacts" element={<ContactList />} />
            <Route path="/readings" element={<ReadingList />} />
            <Route path="/" element={<SensorList />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

// Wrapper component to handle sensor editing
function SensorFormWrapper() {
  // In a real app, you would fetch the sensor by ID from the URL params
  return <SensorForm sensor={null} onSuccess={(msg) => alert(msg)} />;
}

export default App;