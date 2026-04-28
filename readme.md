# 🌡️ Entity Glass Bar Card

A sleek, vertical glass-tube style bar card for Home Assistant. 

This card was originally created for personal use to achieve a specific, clean aesthetic on my own dashboard. I decided to share it with the Home Assistant community, hoping that others will find it useful and enjoy the design as much as I do.

<img width="510" height="510" alt="Image" src="https://github.com/user-attachments/assets/c46af4bf-a00d-4492-b28c-57a2bdc1c276" />

---

## ✨ Features
*   **Glassmorphism Design:** Realistic glass effect with highlights, depth, and reflections.
*   **Segmented Layout:** Option to display bars as discrete blocks, perfect for battery or level indicators.
*   **Smart Snapping:** In segmented mode, the fill level automatically snaps to the top of the nearest block.
*   **Smart Colors:** Automatic color logic for `temperature`, `humidity`, `battery` and `light` device classes.
*   **Vertical Space Saving:** Uses rotated labels and icons to maximize information density.
*   **Precision Ticks:** Mathematically aligned measurement ticks.
*   **Interactive:** Built-in tap-action to open the "More Info" dialog for each entity.

---

## 🛠️ Installation

### Via HACS (Recommended)
1. Open **HACS** in your Home Assistant.
2. Go to **Frontend**.
3. Click the three dots in the top right and select **Custom repositories**.
4. Paste the URL of this repository and select **Dashboard** as the category.
5. Click **Add** and then **Download**.

---

## 📋 Configuration Options


### Global Options

| Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | **Required** | `custom:entity-glass-bar-card` |
| `entities` | list | **Required** | List of entities to display. |
| `title` | string | optional | Title of the card. |
| `height` | number | `200` | Total height of the bars in pixels. |
| `width` | number | `40` | Width of each bar in pixels. |
| `radius` | number | `20` | Border radius for the bars. |
| `color` | string | `null` | Global RGB color (e.g., `255, 165, 0`) or CSS variable (e.g., `var(--primary-color)`). |
| `step` | number | `null` | Global tick interval (defaults: 5 for temperature, 10 for others). |
| `segmented` | boolean | `false` | Enable segmented/blocked layout globally. |
| `severity` | list | optional | Global dynamic color thresholds (see Severity section). |
| `show_ticks` | boolean | `true` | Show or hide measurement ticks. |
| `show_name` | boolean | `true` | Show or hide entity names. |
| `show_icon` | boolean | `true` | Show or hide entity icons. |
| `show_value` | boolean | `true` | Show or hide current values. |
| `decimals` | number | HA default | Number of decimal places to show. |
| `segmented` | boolean | `false` | Enable stepped/segmented bar appearance. |
| `unit` | string | `null` | Global unit override for all entities. |
| `icon` | string | `null` | Global icon override for all entities. |

### Entity Options

| Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `entity` | string | **Required** | The entity ID. |
| `name` | string | null | Custom name override. |
| `icon` | string | null | Custom icon override (e.g., `mdi:fire`). |
| `unit` | string | null | Custom unit override (e.g., `hPa`). |
| `decimals` | number | null | Entity-specific decimal precision. |
| `step` | number | null | The interval between ticks or segments (e.g., 5). |
| `min` | number | 0 / -5 | Minimum scale value (defaults: -5 for temp, 0 for others). |
| `max` | number | 35 / 100 | Maximum scale value (defaults: 35 for temp, 100 for others). |
| `charging_entity` | string | null | Binary sensor to trigger charging animation. |
| `color` | string | null | Static RGB color (e.g., `255, 100, 0`). |

### Severity Options
The `severity` option allows you to change the bar color based on its value. It can be defined globally.

| Name | Type | Description |
| :--- | :--- | :--- |
| value | number | The threshold value (color applied if state is less than or equal to this). |
| color | string | RGB color or CSS variable. |

---

## 💡 Example Usage

### Basic Example
<img width="394" height="325" alt="Image" src="https://github.com/user-attachments/assets/0f935ba7-fc14-4ccb-80a8-26ab250b0f73" />
```yaml
type: custom:entity-glass-bar-card
title: "Temperature and humidity"
entities:
  - entity: sensor.indoor_temperature
    name: Indoor temp.
  - entity: sensor.outdoor_temperature
    name: Outdoor temp.
  - entity: sensor.indoor_humidity
    name: Indoor hum.
  - entity: sensor.outdoor_humidity
    name: Outdoor hum.
```

### Segmented Battery Style With Charging Indicator (New in v0.2.5)
<img width="394" height="279" alt="Image" src="https://github.com/user-attachments/assets/2224a876-6854-4a92-b5b8-04fae069ae7e" />
```yaml
type: custom:entity-glass-bar-card
title: Battery level
width: 50
height: 160
radius: 5
step: 20
show_icon: false
segmented: true
entities:
  - entity: sensor.my_phone_battery_level
    name: My Phone
    charging_entity: binary_sensor.my_phone_is_charging
  - entity: sensor.ford_mustang_mach_e_battery
    name: Ford Mach-E
    step: 10
  - entity: sensor.back_to_the_future
    name: Flux capacitor
  - entity: sensor.palm_sensor_battery
    name: Palm tree sensor
  - entity: sensor.random_battery_level
    name: Too long name for this entity
```

### Toner level
<img width="394" height="216" alt="Image" src="https://github.com/user-attachments/assets/f6535fb5-5d87-48f9-83f3-b3a7727482ce" />
```yaml
type: custom:entity-glass-bar-card
title: Printer toner level
show_ticks: false
show_icon: false
show_name: false
width: 70
height: 100
radius: 1
entities:
  - entity: sensor.toner_cyan
    color: 0,255,255
  - entity: sensor.toner_magenta
    color: 255,0,255
  - entity: sensor.toner_yellow
    color: 255,255,0
  - entity: sensor.toner_black
    color: 0,0,0
```

### Advanced Example with Severity and Steps
```yaml
type: custom:entity-glass-bar-card
title: "Sensors"
height: 250
step: 10
severity:
  - value: 20
    color: "255, 0, 0"
  - value: 60
    color: "255, 165, 0"
  - value: 100
    color: "76, 175, 80"
entities:
  - entity: sensor.living_room_temp
    name: "Temp"
    max: 40
    step: 5
  - entity: light.living_room_main
    name: "Main Light"
  - entity: sensor.humidity
    name: "Humidity"
```

### Combine with auto-entities
```yaml
card:
  title: Battery
  type: custom:entity-glass-bar-card
  segmented: true
  height: 150
  width: 50
  radius: 5
  show_icon: false
filter:
  include:
    - entity_id: sensor.*battery
  exclude:
    - entity_id: "*phone_battery"
sort:
  method: state
  numeric: true
type: custom:auto-entities
```

---

## 🙏 Inspired By
This project was inspired by the following amazing works:
*   [bar-card](https://github.com/custom-cards/bar-card) - For the foundation of bar-based visualizations.
*   [Frosted Glass Themes](https://github.com/wessamlauf/homeassistant-frosted-glass-themes) - For the beautiful glass-morphism aesthetic.
