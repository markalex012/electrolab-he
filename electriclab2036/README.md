# ElectricLab 2036

Hebrew RTL browser-based electrical automation laboratory. 30 independently adapted single-phase load simulations with source PDFs from https://elecstudy.org/automation/.

Open index.html or serve this folder with any static web server. No build or paid API required.

Edit data.js for project definitions, model.js for simulation rules, app.js for UI, future.css for the 2036 design. imagery.css maps unique generated photographic illustrations.

Run node tests.cjs for simulation checks. ESP-NOW, mains wiring and Arduino code are educational simulations; this does not connect to real hardware.

## Real hardware photographs

All 30 project interiors use downloaded real-world hardware photographs, including the controller, touchscreen, input sensors, switching devices, loads and wiring illustrations. Sources, authors, license notices and resize/crop notes are recorded in photo-sources.json and the linked photo-sources.html page. Unspecified equipment models are representative examples, not purchase specifications. The generated main catalogue imagery is unchanged.

Browser verification: all 30 project pages rendered with sensor, load and schematic photos; no broken loaded images. Existing 90 model boundary scenarios passed.

## 3.3V control interface review

Every photographed schematic component links to its own photo-sources.html card in the same tab. SVG links are keyboard accessible; image and component-label hit areas are covered.

control-interfaces.js and control-audit.json document all 97 output channels. Nominal 3.3V control front ends were checked against manufacturer documents. This is a document-based design review, not hardware testing or certification. 54 channels need an exact compatible downstream controller/load model. Mains and coil power remain separate from GPIO logic.

Corrections include the Carlo Gavazzi SSR identity and model-specific input range, replacement of the under-rated Mini Relay in the design, and explicit MOSFET / Power Relay / I2C-to-0-10V interfaces instead of direct GPIO-to-mains-equipment assumptions.

## Smart home expansion

Eight sensor inputs and eight actuator channels. RFID grants expire after five simulation seconds; unknown tags deny entry. Armed door/window alarm, separate fire/gas warning, flame-controlled sprinkler valve, full gas ventilation inhibited by flame, and hazard cutoff of normal heat/light/ceiling fan. Manual 0–100% dimmer and optional light/presence automation update both the photographic lamp and schematic continuously. Lock uses a separate 12V DC MOSFET path. MQ-2 uses 5V and requires safe ADC scaling. All life-safety behavior is explicitly an educational simulation. Run `node tests-home.cjs` in addition to the shared model tests.
