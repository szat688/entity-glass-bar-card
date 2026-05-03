/**
 * EntityGlassBarCard - v0.40.1
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

// Helper to interpolate between two RGB colors
function interpolateColor(color1, color2, factor) {
  const c1 = color1.split(',').map(Number);
  const c2 = color2.split(',').map(Number);
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
  return `${r}, ${g}, ${b}`;
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
    this._columns = config.columns || null;
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

  // Calculate all dynamic data for a bar in one place
  _getBarData(ent, stateObj, hass) {
    if (!stateObj) return null;

    const entityId = typeof ent === 'string' ? ent : ent.entity;
    let rawVal = parseFloat(stateObj.state);
    if (entityId.startsWith('light.')) {
      rawVal = ((stateObj.attributes.brightness || 0) / 255) * 100;
    } else {
      rawVal = rawVal || 0;
    }

    const deviceClass = stateObj.attributes.device_class;
    const tempUnit = stateObj.attributes.unit_of_measurement || (hass.config ? hass.config.unit_system.temperature : '°C');
    const isFahrenheit = tempUnit === '°F' || tempUnit === 'F';

    // 1. Min/Max & Percentage
    const min = ent.min !== undefined ? ent.min : (deviceClass === 'temperature' ? (isFahrenheit ? 23 : -5) : 0);
    const max = ent.max !== undefined ? ent.max : (deviceClass === 'temperature' ? (isFahrenheit ? 95 : 35) : 100);
    const pct = Math.min(Math.max(((rawVal - min) / (max - min)) * 100, 0), 100);

    // 2. Color Logic (with your new deadbands and thresholds)
    let color;
    if (this._config.severity && Array.isArray(this._config.severity)) {
      const sortedSeverity = [...this._config.severity].sort((a, b) => a.value - b.value).map(s => ({ v: s.value, c: s.color }));
      color = this._getInterpolatedColor(rawVal, sortedSeverity);
    } 
    else if (ent.color) color = ent.color;
    else if (this._globalColor) color = this._globalColor;
    else if (deviceClass === 'temperature') {
      const thresholds = isFahrenheit 
        ? [{ v: 14, c: '0,128,255' }, { v: 41, c: '255,255,255' }, { v: 68, c: '64,191,64' }, { v: 77, c: '64,191,64' }, { v: 86, c: '255,165,0' }, { v: 95, c: '192,57,43' }]
        : [{ v: -10, c: '0,128,255' }, { v: 5, c: '255,255,255' }, { v: 20, c: '64,191,64' }, { v: 25, c: '64,191,64' }, { v: 30, c: '255,165,0' }, { v: 35, c: '192,57,43' }];
      color = this._getInterpolatedColor(rawVal, thresholds);
    }
    else if (deviceClass === 'battery') {
      color = this._getInterpolatedColor(rawVal, [{ v: 10, c: '191,64,64' }, { v: 25, c: '255,165,0' }, { v: 50, c: '191,149,64' }, { v: 80, c: '64,191,64' }]);
    }
    else if (deviceClass === 'humidity') {
      color = this._getInterpolatedColor(rawVal, [{ v: 30, c: '255,165,0' }, { v: 45, c: '64,191,64' }, { v: 55, c: '64,191,64' }, { v: 70, c: '0,128,255' }, { v: 90, c: '0,50,150' }]);
    }
    else if (entityId.startsWith('light.')) {
      color = this._getInterpolatedColor(rawVal, [{ v: 0, c: '50,50,50' }, { v: 30, c: '255,180,40' }, { v: 70, c: '255,230,80' }, { v: 100, c: '255,255,220' }]);
    }
    else color = 'var(--accent-color, 128,128,128)';

    // 3. Formatting and Unit logic
    const decimals = ent.decimals !== undefined ? ent.decimals : (this._globalDecimals !== null ? this._globalDecimals : (stateObj.attributes.display_precision !== undefined ? stateObj.attributes.display_precision : 0));
    let unit = ent.unit !== undefined ? ent.unit : (this._globalUnit !== null ? this._globalUnit : (stateObj.attributes.unit_of_measurement || ""));
    if (entityId.startsWith('light.') && unit === "") {
      unit = "%";
    }

    return {
      entityId,
      rawVal,
      val: rawVal.toFixed(decimals),
      pct,
      color,
      unit,
      icon: ent.icon || this._globalIcon || stateObj.attributes.icon || (deviceClass === 'humidity' ? "mdi:water-percent" : deviceClass === 'battery' ? "mdi:battery" : deviceClass === 'temperature' ? "mdi:thermometer" : entityId.startsWith('light.') ? "mdi:lightbulb" : "mdi:eye"),
      name: ent.name || stateObj.attributes.friendly_name || "Sensor",
      isCharging: ent.charging_entity && (hass.states[ent.charging_entity]?.state === 'on')
    };
  }

  // Helper to calculate interpolated color based on thresholds
  _getInterpolatedColor(val, thresholds) {
    if (val <= thresholds[0].v) return thresholds[0].c;
    if (val >= thresholds[thresholds.length - 1].v) return thresholds[thresholds.length - 1].c;
    for (let i = 0; i < thresholds.length - 1; i++) {
      const low = thresholds[i], high = thresholds[i + 1];
      if (val >= low.v && val <= high.v) {
        return interpolateColor(low.c, high.c, (val - low.v) / (high.v - low.v));
      }
    }
    return thresholds[0].c;
  }

  set hass(hass) {
    if (!this.content) {
      const containerStyle = this._columns 
        ? `display: grid; grid-template-columns: repeat(${this._columns}, 1fr); justify-items: center; gap: 10px;`
        : `display: flex; flex-direction: row; gap: 10px; justify-content: space-evenly; flex-wrap: wrap;`;
        
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
          <div id="container" style="${containerStyle}"></div>
        </ha-card>
      `;
      this.content = this.querySelector('#container');
      this.titleElement = this.querySelector('#card-title');
    }

    this.titleElement.innerText = this._config.title || "";
    this.titleElement.style.display = this._config.title ? "block" : "none";

    this._config.entities.forEach((ent, index) => {
      const entityId = typeof ent === 'string' ? ent : ent.entity;
      const data = this._getBarData(ent, hass.states[entityId], hass);
      if (!data) return;

      let bar = this.content.children[index];
      
      // INITIAL RENDER FOR THE INDIVIDUAL BAR
      if (!bar) {

        const barHtml = `
            <div class="glass-bar" data-entity="${data.entityId}" style="height: ${this._height}px; width: ${this._width}px; border-radius: ${this._radius}px;
            position: relative; overflow: hidden; background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.15) 100%); padding: 2px; box-sizing: border-box;
            cursor: pointer; transition: all 0.5s ease; border: 1px solid rgba(255,255,255,0.2); box-shadow: inset 4px 0 10px rgba(0,0,0,0.2), inset -2px 0 6px rgba(255,255,255,0.05);">
            
            <!-- 1. Inner Glass Tube Outline -->
            <div class="bar-inner-border" style="position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; 
                        border: 1px solid rgba(255,255,255,0.07); border-radius: ${this._radius-2}px; z-index: 0; pointer-events: none;"></div>
        
            <!-- 2. Glossy Top-Left Reflection -->
            <div style="position: absolute; top: 5px; left: 6px; width: 22%; height: 14%; 
                        background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%); 
                        border-radius: ${this._radius}px 4px 4px 4px; z-index: 5; pointer-events: none; filter: blur(0.5px);"></div>
        
            <!-- 3. Liquid / Fill Level -->
            <div class="bar-fill" style="position: absolute; bottom: 2px; left: 2px; right: 2px; 
                        transition: height 1.5s cubic-bezier(0.17, 0.67, 0.83, 0.67), background 0.5s ease; z-index: 1;"></div>
        
            <!-- 4. Precision Ticks -->
            <div class="bar-ticks-container"></div>
        
            <!-- 5. Centered Reflection (Depth) -->
            <div style="position: absolute; top: 0; left: 15%; width: 20%; height: 100%; 
                        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 100%); 
                        z-index: 3; pointer-events: none;"></div>
        
            <!-- 6. Value Label -->
            <div class="bar-value" style="position: absolute; top: ${(!this._showName && !this._showIcon) ? (this._height / 2) : 60}px; left: 50%; width: 100px;
            height: 0px; display: flex; justify-content: ${(!this._showName && !this._showIcon) ? 'center' : 'flex-end'}; align-items: center;
            transform: translateX(-50%) rotate(-90deg); transform-origin: center center; color: white; font-weight: bold; font-size: 14px;
            white-space: nowrap; z-index: 4; text-shadow: 0px 0px 6px rgba(0,0,0,0.8), -2px 1px 2px rgba(0,0,0,1); pointer-events: none;"></div>
        
            <!-- 7. Name Label -->
            <div class="bar-name" style="position: absolute; bottom: ${this._showIcon ? 25 : 3}px; left: 50%; padding: 5px; margin-bottom: -10px; transform: rotate(-90deg);
            transform-origin: left center; font-size: 0.9em; color: rgba(255,255,255,0.95); white-space: nowrap; z-index: 4;
            text-shadow: 0px 0px 6px rgba(0,0,0,0.8), -2px 1px 2px rgba(0,0,0,1); font-weight: 500; overflow: hidden; text-overflow: ellipsis; pointer-events: none;"></div>
        
            <!-- 8. Icon -->
            <div class="bar-icon" style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) rotate(-90deg); color: white; z-index: 4; pointer-events: none;">
              <ha-icon style="--mdc-icon-size: 18px; filter: drop-shadow(0px 0px 4px rgba(0,0,0,0.8)) drop-shadow(-1px 0px 1px rgba(0,0,0,1));"></ha-icon>
            </div>
          </div>`;

        this.content.insertAdjacentHTML('beforeend', barHtml);
        bar = this.content.children[index];
        bar.addEventListener("click", () => fireEvent(this, "hass-more-info", { entityId: data.entityId }));
      }
    
      // SMART UPDATE - TARGETED DOM UPDATES
      const fill = bar.querySelector('.bar-fill');
      const valueLabel = bar.querySelector('.bar-value');
      const nameLabel = bar.querySelector('.bar-name');
      const iconEl = bar.querySelector('ha-icon');

      // 1 UPDATE PRECISION TICKS DYNAMICALLY
      // Logic: Redraw ticks every update to handle dynamic min/max or config changes
      const ticksContainer = bar.querySelector('.bar-ticks-container');
      let ticksHtml = "";
      
      if (this._showTicks && !this._globalSegmented) {
        const stateObj = hass.states[entityId];
        const deviceClass = stateObj.attributes.device_class;
        const step = ent.step || this._globalStep || (deviceClass === 'temperature' ? 5 : 10);
        
        // Re-calculate ranges based on current data
        const tempUnit = stateObj.attributes.unit_of_measurement || (hass.config ? hass.config.unit_system.temperature : '°C');
        const isFahrenheit = tempUnit === '°F' || tempUnit === 'F';
        const currentMin = ent.min !== undefined ? ent.min : (deviceClass === 'temperature' ? (isFahrenheit ? 23 : -5) : 0);
        const currentMax = ent.max !== undefined ? ent.max : (deviceClass === 'temperature' ? (isFahrenheit ? 95 : 35) : 100);
        
        const range = currentMax - currentMin;
        const tickCount = Math.floor(range / step);
        const totalInnerHeight = this._height - 4;
        
        for (let i = 1; i < tickCount; i++) {
          const posPx = Math.round((i * step / range) * totalInnerHeight);
          ticksHtml += `<div style="position: absolute; left: 0; width: 6px; bottom: ${posPx}px; border-bottom: 1px solid rgba(255,255,255,0.4); z-index: 2; pointer-events: none;"></div>`;
        }
      }
      // Apply the generated ticks (or empty string if disabled)
      if (ticksContainer.innerHTML !== ticksHtml) {
        ticksContainer.innerHTML = ticksHtml;
      }

      // 2.0 UPDATE LIQUID / FILL LEVEL
      let displayPct = data.pct;
      
      // 2.1 REFINED SEGMENTED CALCULATIONS
      const currentStateObj = hass.states[entityId];
      const currentDeviceClass = currentStateObj.attributes.device_class;
      const currentStep = ent.step || this._globalStep || (currentDeviceClass === 'temperature' ? 5 : 10);
      
      const currentTempUnit = currentStateObj.attributes.unit_of_measurement || (hass.config ? hass.config.unit_system.temperature : '°C');
      const isFah = currentTempUnit === '°F' || currentTempUnit === 'F';
      const curMin = ent.min !== undefined ? ent.min : (currentDeviceClass === 'temperature' ? (isFah ? 23 : -5) : 0);
      const curMax = ent.max !== undefined ? ent.max : (currentDeviceClass === 'temperature' ? (isFah ? 95 : 35) : 100);
      const curRange = curMax - curMin;

      const segmentCount = Math.floor(curRange / currentStep);
      const segmentHeightPx = (this._height - 4) / segmentCount;

      // 2.1.1 SNAPPING LOGIC
      if (this._globalSegmented) {
          const segmentSizePct = 100 / segmentCount;
          const activeSegments = Math.ceil(data.pct / segmentSizePct);
          displayPct = activeSegments * segmentSizePct;
      }
      
      const maskCutoff = 100 - displayPct; 

      // 2.2 APPLY BASE STYLES TO 100% FILL
      const innerRadius = this._radius - 2;
      fill.style.height = `calc(100% - 4px)`;
      fill.style.top = `2px`;
      
      // 2.2.1 LAYERED BACKGROUND WITH PRECISE BOTTOM SHADOW
      const colorVal = data.color.startsWith('var') ? data.color : `rgb(${data.color})`;
      const tubeShading = `linear-gradient(90deg, rgba(255,255,255, 0.7) -50%, ${colorVal} 35%, rgba(0,0,0,0.35) 100%)`;
      const bottomShadow = `radial-gradient(circle at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 80%)`;
      fill.style.background = `${bottomShadow}, ${tubeShading}`;
      
      // 2.2.2 CONSTRAIN THE BOTTOM SHADOW AREA
      const shadowHeight = (this._width / 2); 
      fill.style.backgroundSize = `100% ${shadowHeight}px, 100% 100%`;
      fill.style.backgroundPosition = `bottom, center`;
      fill.style.backgroundRepeat = `no-repeat, no-repeat`;
      
      fill.style.boxShadow = `0 0 12px rgba(${data.color.startsWith('var') ? '255,255,255' : data.color}, 0.25)`;
      fill.style.borderRadius = `${innerRadius}px`;
      
      // 2.3 CONSTRUCT THE DYNAMIC MASK
      let levelMask = `linear-gradient(to bottom, transparent 0%, transparent ${maskCutoff}%, black ${maskCutoff}%, black 100%)`;
      
      // Default values for continuous mode
      let maskImg = levelMask;
      let maskSize = "100% 100%";
      let maskPos = "center top";
      let maskRep = "no-repeat";
      let maskComp = "source-over";
      let maskCompStd = "add";

      // Override values for segmented mode
      if (this._globalSegmented) {
          const segmentMask = `linear-gradient(to bottom, transparent 0px, transparent 2px, black 2px, black 100%)`;
          maskImg = `${levelMask}, ${segmentMask}`;
          maskSize = `100% 100%, 100% ${segmentHeightPx}px`;
          maskPos = "center top, center bottom";
          maskRep = "no-repeat, repeat-y";
          maskComp = "source-in";
          maskCompStd = "intersect";
      }

      // 2.4 APPLY MASK STYLES IN ONE BLOCK
      fill.style.webkitMaskImage = maskImg;
      fill.style.maskImage = maskImg;
      fill.style.webkitMaskSize = maskSize;
      fill.style.maskSize = maskSize;
      fill.style.webkitMaskPosition = maskPos;
      fill.style.maskPosition = maskPos;
      fill.style.webkitMaskRepeat = maskRep;
      fill.style.maskRepeat = maskRep;
      fill.style.webkitMaskComposite = maskComp;
      fill.style.maskComposite = maskCompStd;
      fill.style.webkitMaskClip = "border-box";
      fill.style.maskClip = "border-box";

      fill.style.borderRadius = `${innerRadius}px`;

      // 3.0 UPDATE LABELS AND DYNAMIC SIZING
      valueLabel.innerText = `${data.val}${data.unit}`;
      valueLabel.style.display = this._showValue ? 'flex' : 'none';
      
      nameLabel.innerText = data.name;
      nameLabel.style.display = this._showName ? 'block' : 'none';
      
      // 3.1 CALCULATE RESERVED SPACE FOR TEXT ALIGNMENT
      const valText = data.val.toString();
      const unitText = data.unit.toString();
      const textLen = valText.length + unitText.length;
      
      const spaceForValue = this._showValue ? (textLen * 6 + 35) : 15;
      const spaceForIcon = this._showIcon ? 30 : 10;
      
      // 3.2 SET DYNAMIC MAX-WIDTH TO PREVENT OVERLAP
      const availableNameSpace = this._height - spaceForValue - spaceForIcon;
      nameLabel.style.maxWidth = `${availableNameSpace}px`;

      // 3.3 POSITION VALUE LABEL DYNAMICALLY
      if (!this._showName && !this._showIcon) {
          valueLabel.style.top = `${this._height / 2}px`;
          valueLabel.style.justifyContent = 'center';
      } else {
          valueLabel.style.top = `60px`;
          valueLabel.style.justifyContent = 'flex-end';
      }

      // 4. Update Icon
      if (iconEl.getAttribute('icon') !== data.icon) {
        iconEl.setAttribute('icon', data.icon);
      }
      bar.querySelector('.bar-icon').style.display = this._showIcon ? 'block' : 'none';

      // 5. Update Charging State & Glow
      if (data.isCharging) {
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