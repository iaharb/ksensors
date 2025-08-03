import React, { useState, useEffect } from 'react';
import { sensorsAPI } from '../../services/api';

const SensorList = () => {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const data = await sensorsAPI.getAll();
        setSensors(data);
      } catch (error) {
        console.error('Failed to fetch sensors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this sensor?')) {
      const success = await sensorsAPI.delete(id);
      if (success) {
        setSensors(sensors.filter(sensor => sensor.id !== id));
      }
    }
  };

  if (loading) return <div>Loading sensors...</div>;

  return (
    <div className="sensor-list">
      <h2>Sensors</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map(sensor => (
            <tr key={sensor.id}>
              <td>{sensor.id}</td>
              <td>{sensor.name}</td>
              <td>{sensor.location}</td>
              <td>
                <button onClick={() => console.log('Edit', sensor.id)}>Edit</button>
                <button onClick={() => handleDelete(sensor.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SensorList;