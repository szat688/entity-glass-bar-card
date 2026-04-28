/**
 * EntityGlassBarCard - v0.2.5
 * A vertical, glass-style bar card for Home Assistant
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
    this._globalSegmented = config.segmented !== undefined ? config.segmented : false;
    this._globalDecimals = config.decimals !== undefined ? config.decimals : null;
    this._globalUnit = config.unit !== undefined ? config.unit : null;
    this._globalIcon = config.icon !== undefined ? config.icon : null;

    // VISIBILITY TOGGLES
    this._showTicks = config.show_ticks !== undefined ? config.show_ticks : true;
    this._showName = config.show_name !== undefined ? config.show_name : true;
    this._showIcon = config.show_icon !== undefined ? config.show_icon : true;
    this._showValue = config.show_value !== undefined ? config.show_value : true;
  }

  set hass(hass) {
    if (!this.content) {
      this.innerHTML = `
        <!-- glowing animation for batteries -->
        <style>
          @keyframes pulse-glow {
            0% { filter: brightness(1); }
            10% { filter: brightness(1.2) drop-shadow(0 0 4px rgba(100, 210, 255, 0.4)); }
            20% { filter: brightness(1); }
            100% { filter: brightness(1); }
          }
          .charging-pulse {
            animation: pulse-glow 4s infinite ease-in-out;
          }
        </style>
        <!-- default state -->
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
      this._segmentStyles = ""; 

      // CHECK FOR CHARGING STATE
      let isCharging = false;
      if (ent.charging_entity) {
        const chargeState = hass.states[ent.charging_entity];
        isCharging = chargeState && (chargeState.state === 'on' || chargeState.state === 'true');
      }

      // DEFINE DYNAMIC GLOW AND ANIMATION FOR CHARGING
      const chargingClass = isCharging ? 'charging-pulse' : '';
      const chargingGlow = isCharging 
        ? `box-shadow: inset 0 0 15px rgba(100, 210, 255, 0.6), 0 0 10px rgba(100, 210, 255, 0.3); border: 1px solid rgba(150, 230, 255, 0.5);` 
        : `box-shadow: inset 4px 0 10px rgba(0,0,0,0.2), inset -2px 0 6px rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2);`;

      // USE RAW VALUE FOR CALCULATIONS
      let rawVal = parseFloat(stateObj.state);
      
      // If it's a light entity, use brightness attribute instead of state string ('on'/'off')
      if (entityId.startsWith('light.')) {
        const brightness = stateObj.attributes.brightness || 0;
        rawVal = (brightness / 255) * 100;
      } else {
        rawVal = rawVal || 0;
      }

      // HANDLE DECIMAL PRECISION
      // Logic: 1. Individual entity config, 2. Global config, 3. Native HA display_precision, 4. Default 0
      const decimals = ent.decimals !== undefined ? ent.decimals : (this._globalDecimals !== null ? this._globalDecimals : (stateObj.attributes.display_precision !== undefined ? stateObj.attributes.display_precision : 0));
      const val = rawVal.toFixed(decimals);
      
      const name = ent.name || stateObj.attributes.friendly_name || "Sensor";
      const deviceClass = stateObj.attributes.device_class;
      
      // UNIT LOGIC
      // Priority: 1. Entity config, 2. Global config, 3. Native HA unit, 4. Light default
      let unit = ent.unit !== undefined ? ent.unit : (this._globalUnit !== null ? this._globalUnit : (stateObj.attributes.unit_of_measurement || ""));
      if (entityId.startsWith('light.') && unit === "" && !ent.unit && !this._globalUnit) { unit = "%"; }
      
      // 1. MIN/MAX AND PERCENTAGE
      // Detect temperature unit from system if available, or from the entity itself
      const tempUnit = stateObj.attributes.unit_of_measurement || hass.config.unit_system.temperature;
      const isFahrenheit = tempUnit === '°F' || tempUnit === 'F';
      let min = ent.min !== undefined ? ent.min : 
                (deviceClass === 'temperature' ? (isFahrenheit ? 23 : -5) : 0);
      let max = ent.max !== undefined ? ent.max : 
                (deviceClass === 'temperature' ? (isFahrenheit ? 95 : 35) : 100);
      let pct = Math.min(Math.max(((rawVal - min) / (max - min)) * 100, 0), 100);

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
        // Temperature scales shifted for Fahrenheit if needed
        if (isFahrenheit) {
          if (rawVal >= 82) color = '192,57,43';      // ~28°C
          else if (rawVal >= 75) color = '191,149,64'; // ~24°C
          else if (rawVal >= 68) color = '64,191,64';  // ~20°C
          else if (rawVal > 32) color = '0,128,255';   // >0°C
          else color = '255,255,255';
        } else {
          if (rawVal >= 28) color = '192,57,43';
          else if (rawVal >= 24) color = '191,149,64';
          else if (rawVal >= 20) color = '64,191,64';
          else if (rawVal > 0) color = '0,128,255';
          else color = '255,255,255';
        }
      } 
      else if (entityId.startsWith('light.')) {
        if (val >= 80) color = '255, 255, 200';
        else if (val >= 40) color = '255, 230, 80';
        else color = '255, 180, 40';
      }
      else color = 'var(--accent-color, 128,128,128)';

      // 3. ICON LOGIC
      // Priority: 1. Entity config, 2. Global config, 3. Native HA icon, 4. Device class defaults
      let icon = ent.icon || this._globalIcon || stateObj.attributes.icon;
      if (!icon) {
        if (deviceClass === 'humidity') icon = "mdi:water-percent";
        else if (deviceClass === 'battery') icon = "mdi:battery";
        else if (deviceClass === 'temperature') icon = "mdi:thermometer";
        else if (entityId.startsWith('light.')) icon = "mdi:lightbulb";
        else icon = "mdi:eye";
      }

      // 4. PRECISION TICKS & SEGMENTATION LOGIC
      let ticksHtml = "";
      const step = ent.step || this._globalStep || (deviceClass === 'temperature' ? 5 : 10);
      const range = max - min;
      const tickCount = Math.floor(range / step);
      const totalInnerHeight = this._height - 4;
      
      let displayPct = pct;
      
      if (this._globalSegmented) {
        const segmentSizePct = 100 / tickCount;
        const activeSegments = Math.ceil(pct / segmentSizePct);
        displayPct = activeSegments * segmentSizePct;
      
        const segmentHeightPx = totalInnerHeight / tickCount;
        const segmentMask = `linear-gradient(to top, white 0px, white calc(100% - 2px), transparent calc(100% - 2px), transparent 100%)`;
        
        // Directly set the mask style
        this._segmentStyles = `
          -webkit-mask-image: ${segmentMask};
          mask-image: ${segmentMask};
          -webkit-mask-size: 100% ${segmentHeightPx}px;
          mask-size: 100% ${segmentHeightPx}px;
          -webkit-mask-repeat: repeat-y;
          mask-repeat: repeat-y;
          -webkit-mask-position: bottom;
          mask-position: bottom;
          -webkit-mask-origin: content-box;
          mask-origin: content-box;
        `;
      } else {
        // Global off: Clear everything and show ticks if enabled
        this._segmentStyles = "mask-image: none; -webkit-mask-image: none;";
        
        if (this._showTicks) {
          for (let i = 1; i < tickCount; i++) {
            const posPx = Math.round((i * step / range) * totalInnerHeight);
            ticksHtml += `
              <div style="position: absolute; left: 0px; width: 6px; 
                          bottom: ${posPx}px; 
                          border-bottom: 1px solid rgba(255,255,255,0.4); 
                          height: 0; z-index: 2; pointer-events: none;"></div>`;
          }
        }
      }

      // DYNAMIC CALCULATIONS FOR LAYOUT
      const nameBottom = this._showIcon ? 25 : 3;
      const valueTop = 15;
      
      // RESERVED SPACE CALCULATION
      let reservedTop = (this._showValue ? 55 : 15);
      let reservedBottom = (this._showIcon ? 30 : 10);
      const maxNameWidth = this._height - reservedTop - reservedBottom;

      // 5. HTML STRUCTURE ASSEMBLY
      html += `
        <div class="glass-bar ${chargingClass}" 
             onclick="this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: '${entityId}'}, bubbles: true, composed: true}));" 
             style="height: ${this._height}px; width: ${this._width}px; border-radius: ${this._radius}px; position: relative; overflow: hidden; 
                    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.15) 100%); 
                    padding: 2px; box-sizing: border-box; cursor: pointer;
                    transition: all 0.5s ease;
                    ${chargingGlow}">
          
          <!-- Inner Glass Tube Outline -->
          <div style="position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; 
                      border: 1px solid rgba(255,255,255,0.07); 
                      border-radius: ${innerRadius}px; z-index: 0; pointer-events: none;"></div>

          <!-- Glossy Top-Left Reflection -->
          <div style="position: absolute; top: 5px; left: 6px; width: 22%; height: 14%; 
                      background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%); 
                      border-radius: ${this._radius}px 4px 4px 4px; z-index: 5; pointer-events: none; filter: blur(0.5px);"></div>

          <!-- Liquid / Fill Level -->
          <div style="position: absolute; bottom: 2px; left: 2px; right: 2px; height: calc(${displayPct}% - 4px); 
                      background: linear-gradient(90deg, rgba(255,255,255, 0.7) -50%, rgb(${color.startsWith('var') ? '' : color}) ${color.startsWith('var') ? color : ''} 35%, rgba(0,0,0,0.35) 100%); 
                      border-radius: ${pct > 95 ? (pct - 90) * (innerRadius/10) : 0}px ${pct > 95 ? (pct - 90) * (innerRadius/10) : 0}px ${innerRadius}px ${innerRadius}px; 
                      transition: height 1.5s cubic-bezier(0.17, 0.67, 0.83, 0.67); 
                      box-shadow: 0 0 12px rgba(${color.startsWith('var') ? '255,255,255' : color}, 0.25); z-index: 1;
                      ${this._segmentStyles}">
          </div>

          ${ticksHtml}

          <!-- Centered Reflection (Depth) -->
          <div style="position: absolute; top: 0; left: 15%; width: 20%; height: 100%; 
                      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); 
                      z-index: 3; pointer-events: none;">
          </div>

          <!-- VALUE LABEL -->
          <div style="position: absolute; 
                      /* If no name and no icon, center the value, otherwise keep it near top */
                      top: ${(!this._showName && !this._showIcon) ? (this._height / 2) : 60}px; 
                      left: 50%; 
                      width: 100px; 
                      height: 0px; 
                      display: flex; 
                      /* If centered, use center alignment, otherwise stay at the top (flex-end) */
                      justify-content: ${(!this._showName && !this._showIcon) ? 'center' : 'flex-end'}; 
                      align-items: center; 
                      transform: translateX(-50%) rotate(-90deg); 
                      transform-origin: center center; 
                      color: white; 
                      font-weight: bold; 
                      font-size: 14px; 
                      white-space: nowrap; 
                      z-index: 4; 
                      text-shadow: 0px 0px 4px rgba(0,0,0,1), 1px 1px 2px rgba(0,0,0,1); 
                      pointer-events: none;
                      display: ${this._showValue ? 'flex' : 'none'};">
            ${val}${unit}
          </div>


          <!-- NAME LABEL (Truncated with Ellipsis) -->
          <div style="position: absolute; bottom: ${nameBottom}px; left: 50%; transform: rotate(-90deg); transform-origin: left center; 
                      font-size: 0.9em; color: rgba(255,255,255,0.95); white-space: nowrap; z-index: 4; 
                      text-shadow: -1px -1px 1px rgba(0,0,0,0.8), 1px 1px 1px rgba(255,255,255,0.2); font-weight: 500; pointer-events: none;
                      display: ${this._showName ? 'block' : 'none'};
                      max-width: ${this._height - ((val.toString().length + unit.length) * 6 + 35) - (this._showIcon ? 30 : 10)}px;
                      overflow: hidden; 
                      text-overflow: ellipsis;">
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
    
    // --- START OF SMART UPDATE LOGIC ---
    // 1. Initial build: If container is empty, perform first render
    if (this.content.innerHTML === "") {
      this.content.innerHTML = html;
      return;
    }

    // 2. Selective Update: Update only changed parts to keep animations stable
    this._config.entities.forEach((ent, index) => {
      const bar = this.content.children[index];
      if (!bar) return;

      const entityId = typeof ent === 'string' ? ent : ent.entity;
      const stateObj = hass.states[entityId];
      if (!stateObj) return;

      // RE-CALCULATE VALUES
      let rawVal = parseFloat(stateObj.state) || 0;
      if (entityId.startsWith('light.')) rawVal = ((stateObj.attributes.brightness || 0) / 255) * 100;
      const deviceClass = stateObj.attributes.device_class;
      // Detect temperature unit (Fahrenheit vs Celsius)
      const tempUnit = stateObj.attributes.unit_of_measurement || (hass.config ? hass.config.unit_system.temperature : '°C');
      const isFahrenheit = tempUnit === '°F' || tempUnit === 'F';
      // Use dynamic defaults based on temperature unit
      const min = ent.min !== undefined ? ent.min : (deviceClass === 'temperature' ? (isFahrenheit ? 23 : -5) : 0);
      const max = ent.max !== undefined ? ent.max : (deviceClass === 'temperature' ? (isFahrenheit ? 95 : 35) : 100);
      const pct = Math.min(Math.max(((rawVal - min) / (max - min)) * 100, 0), 100);

      // RE-CALCULATE COLOR (Ensure this matches your initial render logic exactly)
      let color;
      
      if (this._config.severity && Array.isArray(this._config.severity)) {
        const sortedSeverity = [...this._config.severity].sort((a, b) => a.value - b.value);
        const found = sortedSeverity.find(s => rawVal <= s.value);
        if (found) color = found.color;
        else color = sortedSeverity[sortedSeverity.length - 1].color;
      } 
      else if (ent.color) color = ent.color;
      else if (this._globalColor) color = this._globalColor;
      else if (deviceClass === 'battery') {
        if (rawVal >= 70) color = '64,191,64';
        else if (rawVal >= 20) color = '191,149,64';
        else color = '191,64,64';
      } 
      else if (deviceClass === 'humidity') {
        if (rawVal >= 70) color = '0,102,204';
        else if (rawVal >= 50) color = '64,191,64';
        else color = '191,149,64';
      } 
      else if (deviceClass === 'temperature') {
        if (isFahrenheit) {
          if (rawVal >= 82) color = '192,57,43';
          else if (rawVal >= 75) color = '191,149,64';
          else if (rawVal >= 68) color = '64,191,64';
          else if (rawVal > 32) color = '0,128,255';
          else color = '255,255,255';
        } else {
          if (rawVal >= 28) color = '192,57,43';
          else if (rawVal >= 24) color = '191,149,64';
          else if (rawVal >= 20) color = '64,191,64';
          else if (rawVal > 0) color = '0,128,255';
          else color = '255,255,255';
        }
      } 
      else if (entityId.startsWith('light.')) {
        if (rawVal >= 80) color = '255, 255, 200';
        else if (rawVal >= 40) color = '255, 230, 80';
        else color = '255, 180, 40';
      }
      else color = 'var(--accent-color, 128,128,128)';

      // RE-CALCULATE SEGMENTED HEIGHT
      let displayPct = pct;
      if (this._globalSegmented) {
        const step = ent.step || this._globalStep || (stateObj.attributes.device_class === 'temperature' ? 5 : 10);
        const range = max - min;
        const tickCount = Math.floor(range / step);
        const segmentSizePct = 100 / tickCount;
        const activeSegments = Math.ceil(pct / segmentSizePct);
        displayPct = activeSegments * segmentSizePct;
      }

      // TARGETED DOM UPDATES
      
      // Update Height (with segment logic)
      const fill = bar.querySelector('div[style*="transition: height"]');
      if (fill) {
        fill.style.height = `calc(${displayPct}% - 4px)`;
        // Smooth top corners when full
        const innerRadius = this._radius - 2;
        fill.style.borderRadius = pct > 95 
          ? `${(pct - 90) * (innerRadius/10)}px ${(pct - 90) * (innerRadius/10)}px ${innerRadius}px ${innerRadius}px`
          : `0px 0px ${innerRadius}px ${innerRadius}px`;
        // Update the fill color dynamically
        const colorVal = color.startsWith('var') ? color : `rgb(${color})`;
        fill.style.background = `linear-gradient(90deg, rgba(255,255,255, 0.7) -50%, ${colorVal} 35%, rgba(0,0,0,0.35) 100%)`;
        fill.style.boxShadow = `0 0 12px rgba(${color.startsWith('var') ? '255,255,255' : color}, 0.25)`;
      }

      // PRE-CALCULATE UNIT AND DECIMALS FOR BOTH LABELS
      const currentUnit = ent.unit !== undefined ? ent.unit : (this._globalUnit !== null ? this._globalUnit : (stateObj.attributes.unit_of_measurement || (entityId.startsWith('light.') ? '%' : '')));
      const currentDecimals = ent.decimals !== undefined ? ent.decimals : (this._globalDecimals !== null ? this._globalDecimals : (stateObj.attributes.display_precision !== undefined ? stateObj.attributes.display_precision : 0));
      const formattedVal = rawVal.toFixed(currentDecimals);

      // Update Value Label
      const valueLabel = bar.querySelector('div[style*="font-weight: bold"]');
      if (valueLabel) {
        valueLabel.innerText = `${formattedVal}${currentUnit}`;
      }

      // UPDATE NAME LABEL WIDTH DYNAMICALLY
      const nameLabel = bar.querySelector('div[style*="font-size: 0.9em"]');
      if (nameLabel) {
        // Use the same 6px and 35 offset logic as in initial render
        const valLen = formattedVal.length + currentUnit.length;
        const newMaxWidth = this._height - (valLen * 6 + 35) - (this._showIcon ? 30 : 10);
        nameLabel.style.maxWidth = `${newMaxWidth}px`;
      }

      // Update Icon
      const iconElement = bar.querySelector('ha-icon');
      if (iconElement) {
        // 1. Manual overrides
        let currentIcon = ent.icon || this._globalIcon;
        // 2. Device class defaults (if no manual override)
        if (!currentIcon) {
          const deviceClass = stateObj.attributes.device_class;
          if (deviceClass === 'humidity') currentIcon = "mdi:water-percent";
          else if (deviceClass === 'battery') currentIcon = "mdi:battery";
          else if (deviceClass === 'temperature') currentIcon = "mdi:thermometer";
          else if (entityId.startsWith('light.')) currentIcon = "mdi:lightbulb";
        }
        // 3. Last resort fallback
        if (!currentIcon) {
          currentIcon = stateObj.attributes.icon || "mdi:eye";
        }
        // Only update DOM if the icon actually changed
        if (iconElement.getAttribute('icon') !== currentIcon) {
          iconElement.setAttribute('icon', currentIcon);
        }
      }

      // Update Charging State
      const isCharging = ent.charging_entity && (hass.states[ent.charging_entity]?.state === 'on');
      if (isCharging) {
        if (!bar.classList.contains('charging-pulse')) {
          bar.classList.add('charging-pulse');
          bar.style.boxShadow = "inset 0 0 15px rgba(100, 210, 255, 0.6), 0 0 10px rgba(100, 210, 255, 0.3)";
          bar.style.borderColor = "rgba(150, 230, 255, 0.5)";
        }
      } else {
        if (bar.classList.contains('charging-pulse')) {
          bar.classList.remove('charging-pulse');
          bar.style.boxShadow = "inset 4px 0 10px rgba(0,0,0,0.2), inset -2px 0 6px rgba(255,255,255,0.05)";
          bar.style.borderColor = "rgba(255,255,255,0.2)";
        }
      }
    });
    // --- END OF SMART UPDATE LOGIC ---
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