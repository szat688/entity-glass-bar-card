/**
 * EntityGlassBarCard - v0.15
 * A vertical, glass-style bar card for Home Assistant
 * Features: Improved truncation math for value label clearance.
 */
 
 function fireEvent(node, type, detail = {}) {
  const event = new CustomEvent(type, {
    detail,
    bubbles: true,
    composed: true,
  });
  node.dispatchEvent(event);
}

 
class EntityGlassBarCard extends HTMLElement {
  constructor() {
    super();
  }

  setConfig(config) {
    if (!config.entities) throw new Error("Please define entities!");
    this._config = config;
    
    // GLOBAL DEFAULTS
    this._height = config.height || 200;
    this._width = config.width || 40;
    this._radius = config.radius || 20;
    this._globalColor = config.color || null;
    this._globalStep = config.step || null;

    // VISIBILITY TOGGLES
    this._showTicks = config.show_ticks !== undefined ? config.show_ticks : true;
    this._showName = config.show_name !== undefined ? config.show_name : true;
    this._showIcon = config.show_icon !== undefined ? config.show_icon : true;
    this._showValue = config.show_value !== undefined ? config.show_value : true;
  }

  set hass(hass) {
    if (!this.content) {
      this.innerHTML = `
        <ha-card style="padding: 16px;">
          <div id="card-title" style="font-size: 20px; padding: 0 0 16px 8px; font-weight: 400; color: var(--primary-text-color);"></div>
          <div id="container" style="display: flex; flex-direction: row; gap: 10px; justify-content: space-evenly; flex-wrap: wrap;"></div>
        </ha-card>
      `;
      this.content = this.querySelector('#container');
      this.titleElement = this.querySelector('#card-title');
      this.content.addEventListener("click", (ev) => {
        const bar = ev.target.closest(".glass-bar");
        if (bar && bar.dataset.entity) {
          ev.stopPropagation();
          fireEvent(this, "hass-more-info", { entityId: bar.dataset.entity });
        }
      });
    }

    this.titleElement.innerText = this._config.title || "";
    this.titleElement.style.display = this._config.title ? "block" : "none";

    let html = "";
    const innerRadius = this._radius - 2;

    this._config.entities.forEach(ent => {
      const entityId = typeof ent === 'string' ? ent : ent.entity;
      const stateObj = hass.states[entityId];
      if (!stateObj) return;

      let val = parseFloat(stateObj.state);
      
      // If it's a light entity, use brightness attribute instead of state string ('on'/'off')
      if (entityId.startsWith('light.')) {
        const brightness = stateObj.attributes.brightness || 0;
        val = Math.round((brightness / 255) * 100);
      } else {
        val = val || 0;
      }
      const name = ent.name || stateObj.attributes.friendly_name || "Sensor";
      const deviceClass = stateObj.attributes.device_class;
      let unit = stateObj.attributes.unit_of_measurement || "";
      if (entityId.startsWith('light.') && !unit) {
        unit = "%";
      }
      
      // 1. MIN/MAX AND PERCENTAGE
      let min = ent.min !== undefined ? ent.min : 0;
      let max = ent.max !== undefined ? ent.max : (deviceClass === 'temperature' ? 40 : 100);
      let pct = Math.min(Math.max(((val - min) / (max - min)) * 100, 0), 100); 

      // 2. COLOR LOGIC
      let color;
      
      // Check for severity thresholds first
      if (this._config.severity && Array.isArray(this._config.severity)) {
        const sortedSeverity = [...this._config.severity].sort((a, b) => a.value - b.value);
        const found = sortedSeverity.find(s => val <= s.value);
        if (found) color = found.color;
        else color = sortedSeverity[sortedSeverity.length - 1].color;
      } 
      // Individual or global fixed color
      else if (ent.color) color = ent.color;
      else if (this._globalColor) color = this._globalColor;
      // Default class-based logic
      else if (deviceClass === 'battery') {
        if (val >= 70) color = '64,191,64';
        else if (val >= 20) color = '191,149,64';
        else color = '191,64,64';
      } 
      else if (deviceClass === 'humidity') {
        if (val >= 70) color = '0,102,204';
        else if (val >= 50) color = '64,191,64';
        else color = '191,149,64';
      } 
      else if (deviceClass === 'temperature') {
        if (val >= 28) color = '192,57,43';
        else if (val >= 24) color = '191,149,64';
        else if (val >= 20) color = '64,191,64';
        else color = '0,128,255';
      } 
      else if (entityId.startsWith('light.')) {
        if (val >= 80) color = '255, 255, 200';
        else if (val >= 40) color = '255, 230, 80';
        else color = '255, 180, 40';
      }
      else color = 'var(--accent-color, 128,128,128)';

      // 3. ICON LOGIC
      let icon = ent.icon || stateObj.attributes.icon;
      if (!icon) {
        if (deviceClass === 'humidity') icon = "mdi:water-percent";
        else if (deviceClass === 'battery') icon = "mdi:battery";
        else if (deviceClass === 'temperature') icon = "mdi:thermometer";
        else if (entityId.startsWith('light.')) icon = "mdi:lightbulb";
        else icon = "mdi:eye";
      }

      // 4. PRECISION TICKS
      let ticksHtml = "";
      if (this._showTicks) {
        const step = ent.step || this._globalStep || (deviceClass === 'temperature' ? 5 : 10);
        const range = max - min;
        const tickCount = Math.floor(range / step);
        const totalInnerHeight = this._height - 4; 

        for (let i = 1; i < tickCount; i++) {
          const posPx = Math.round((i * step / range) * totalInnerHeight);
          ticksHtml += `
            <div style="position: absolute; left: 0px; width: 6px; 
                        bottom: ${posPx}px; 
                        border-bottom: 1px solid rgba(255,255,255,0.4); 
                        height: 0; z-index: 2; pointer-events: none;"></div>`;
        }
      }

      // DYNAMIC CALCULATIONS FOR LAYOUT
      const nameBottom = this._showIcon ? 25 : 8;
      const valueTop = 15;
      
      // RESERVED SPACE CALCULATION (Refined for v0.12)
      let reservedTop = (this._showValue ? 55 : 15);
      let reservedBottom = (this._showIcon ? 30 : 10);
      const maxNameWidth = this._height - reservedTop - reservedBottom;

      // 5. HTML STRUCTURE ASSEMBLY
      html += `
        <div onclick="this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: '${entityId}'}, bubbles: true, composed: true}));" 
             style="height: ${this._height}px; width: ${this._width}px; border-radius: ${this._radius}px; border: 1px solid rgba(255,255,255,0.2); position: relative; overflow: hidden; 
                    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.15) 100%); 
                    box-shadow: inset 4px 0 10px rgba(0,0,0,0.2), inset -2px 0 6px rgba(255,255,255,0.05);
                    padding: 2px; box-sizing: border-box; cursor: pointer;">

          
          <!-- Inner Glass Tube Outline -->
          <div style="position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; 
                      border: 1px solid rgba(255,255,255,0.07); 
                      border-radius: ${innerRadius}px; z-index: 0; pointer-events: none;"></div>

          <!-- Glossy Top-Left Reflection -->
          <div style="position: absolute; top: 5px; left: 6px; width: 22%; height: 14%; 
                      background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%); 
                      border-radius: ${this._radius}px 4px 4px 4px; z-index: 5; pointer-events: none; filter: blur(0.5px);"></div>

          <!-- Liquid / Fill Level -->
          <div style="position: absolute; bottom: 2px; left: 2px; right: 2px; height: calc(${pct}% - 4px); 
                      background: linear-gradient(90deg, rgba(255,255,255, 0.7) -50%, rgb(${color.startsWith('var') ? '' : color}) ${color.startsWith('var') ? color : ''} 35%, rgba(0,0,0,0.35) 100%); 
                      border-radius: ${pct > 95 ? (pct - 90) * (innerRadius/10) : 0}px ${pct > 95 ? (pct - 90) * (innerRadius/10) : 0}px ${innerRadius}px ${innerRadius}px; 
                      transition: height 1.5s cubic-bezier(0.17, 0.67, 0.83, 0.67); 
                      box-shadow: 0 0 12px rgba(${color.startsWith('var') ? '255,255,255' : color}, 0.25); z-index: 1;">
          </div>

          ${ticksHtml}

          <!-- Centered Reflection (Depth) -->
          <div style="position: absolute; top: 0; left: 15%; width: 20%; height: 100%; 
                      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); 
                      z-index: 3; pointer-events: none;">
          </div>

          <!-- VALUE LABEL -->
          <div style="position: absolute; left: 50%; top: ${valueTop}px; transform: translateX(-50%) rotate(-90deg); color: white; font-weight: bold; font-size: 14px; white-space: nowrap; z-index: 4; 
                      text-shadow: 0px 0px 4px rgba(0,0,0,1), 1px 1px 2px rgba(0,0,0,1); pointer-events: none;
                      display: ${this._showValue ? 'block' : 'none'};">
            ${Math.round(val)}${unit}
          </div>

          <!-- NAME LABEL (Truncated with Ellipsis) -->
          <div style="position: absolute; bottom: ${nameBottom}px; left: 50%; transform: rotate(-90deg); transform-origin: left center; 
                      font-size: 0.9em; color: rgba(255,255,255,0.95); white-space: nowrap; z-index: 4; 
                      text-shadow: -1px -1px 1px rgba(0,0,0,0.8), 1px 1px 1px rgba(255,255,255,0.2); font-weight: 500; pointer-events: none;
                      display: ${this._showName ? 'block' : 'none'};
                      max-width: ${maxNameWidth}px; overflow: hidden; text-overflow: ellipsis;">
            ${name}
          </div>

          <!-- ICON -->
          <div style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%) rotate(-90deg); color: white; z-index: 4; pointer-events: none;
                      display: ${this._showIcon ? 'block' : 'none'};">
            <ha-icon icon="${icon}" style="--mdc-icon-size: 18px; filter: drop-shadow(0px 0px 3px rgba(0,0,0,1));"></ha-icon>
          </div>
        </div>
      `;

    });
    this.content.innerHTML = html;
  }
}

// REGISTER CUSTOM CARD
customElements.define('entity-glass-bar-card', EntityGlassBarCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "entity-glass-bar-card",
  name: "Entity Glass Bar Card",
  description: "A sleek, vertical glass-style card for visualizing sensor values with a clean aesthetic.",
  preview: true
});
