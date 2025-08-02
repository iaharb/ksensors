import { Visual } from "./visual";

export class VisualSettingsPane {
  private container: HTMLElement;
  private visual: Visual;

  constructor(container: HTMLElement, visual: Visual) {
    this.container = container;
    this.visual = visual;
    this.render();
  }

  private render() {
    // Clear container safely
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    const pane = document.createElement('div');
    pane.className = 'settings-pane';

    const heading = document.createElement('h3');
    heading.textContent = 'WebSocket Configuration';
    pane.appendChild(heading);

    const formGroup1 = document.createElement('div');
    formGroup1.className = 'form-group';

    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'WebSocket URL:';
    formGroup1.appendChild(urlLabel);

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.id = 'wsUrl';
    urlInput.value = 'wss://your-server:8090';
    formGroup1.appendChild(urlInput);

    pane.appendChild(formGroup1);

    const formGroup2 = document.createElement('div');
    formGroup2.className = 'form-group';

    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max Data Points:';
    formGroup2.appendChild(maxLabel);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.id = 'maxPoints';
    maxInput.value = '100';
    formGroup2.appendChild(maxInput);

    pane.appendChild(formGroup2);

    const applyBtn = document.createElement('button');
    applyBtn.id = 'applyBtn';
    applyBtn.textContent = 'Apply Settings';
    pane.appendChild(applyBtn);

    this.container.appendChild(pane);

    applyBtn.addEventListener('click', () => {
      // Handle settings application
      console.log('Settings applied');
    });
  }
}