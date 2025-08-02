import * as React from "react";
import * as ReactDOM from "react-dom";
import { w3cwebsocket as W3CWebSocket } from "websocket";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

interface SensorData {
  timestamp: Date;
  value: number;
  sensorId: string;
  unit: string;
}

interface VisualProps {
  data: SensorData[];
}

class VisualComponent extends React.Component<VisualProps> {
  render() {
    return (
      `<div className="sensor-container">
        {this.props.data.map((item, index) => (
          <div key={index} className="sensor-item">
            <div className="sensor-value">
              {item.value} {item.unit}
            </div>
            <div className="sensor-meta">
              <span>{item.sensorId}</span>
              <span>{item.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>`
    );
  }
}

export class Visual {
  private ws: W3CWebSocket;
  private data: SensorData[] = [];
  private root: HTMLElement;
  private reactRoot: React.ReactElement;

  constructor(options: VisualConstructorOptions) {
    this.root = options.element;
    
    // Initialize WebSocket connection
    this.ws = new W3CWebSocket('ws://your-server:8090');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const newData: SensorData = JSON.parse(event.data);
        newData.timestamp = new Date(newData.timestamp);
        this.data.push(newData);
        
        // Keep only last 100 readings
        if (this.data.length > 100) {
          this.data.shift();
        }
        
        this.updateVisual();
      }
    };
  }

  private updateVisual() {
    ReactDOM.unmountComponentAtNode(this.root);
    this.reactRoot = React.createElement(VisualComponent, {
      data: this.data
    });
    ReactDOM.render(this.reactRoot, this.root);
  }

  public update(options: VisualUpdateOptions) {
    // Standard Power BI data binding would go here
  }

  public destroy() {
    this.ws.close();
    ReactDOM.unmountComponentAtNode(this.root);
  }
}