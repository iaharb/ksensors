import websocket
import pandas as pd
import matplotlib.pyplot as plt


# Define the WebSocket URL
ws_url = "ws://localhost:8090"

# Function to handle incoming messages
def on_message(ws, message):
    data = pd.DataFrame([message])
    data.to_csv('data.csv', mode='a', header=False, index=False)

# Create a WebSocket app
ws = websocket.WebSocketApp(ws_url, on_message=on_message)

# Run the WebSocket app
ws.run_forever()
