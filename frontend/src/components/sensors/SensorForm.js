import React, { useState } from 'react';
import { sensorsAPI } from '../../services/api';

const SensorForm = ({ sensor, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: sensor?.name || '',
    location: sensor?.location || '',
    buildingId: sensor?.buildingId || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (sensor) {
        // Update existing sensor
        const updatedSensor = await sensorsAPI.update(sensor.id, formData);
        if (updatedSensor) {
          onSuccess('Sensor updated successfully');
        }
      } else {
        // Create new sensor
        const newSensor = await sensorsAPI.create(formData);
        if (newSensor && newSensor.id) {
          onSuccess('Sensor created successfully');
          setFormData({ name: '', location: '', buildingId: '' });
        }
      }
    } catch (error) {
      console.error('Sensor operation failed:', error);
    }
  };

  return (
    <div className="sensor-form">
      <h2>{sensor ? 'Edit Sensor' : 'Add New Sensor'}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Location:</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Building ID:</label>
          <input
            type="text"
            name="buildingId"
            value={formData.buildingId}
            onChange={handleChange}
          />
        </div>
        <button type="submit">{sensor ? 'Update' : 'Create'}</button>
      </form>
    </div>
  );
};

export default SensorForm;