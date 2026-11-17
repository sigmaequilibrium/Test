/* Photonic Wetware Core - content.
 * Most numbers here come from the research passes described in README.md.
 * The indicator wavelengths, the lens array and the imaging cell count are
 * general-knowledge placeholders. Items marked "est." are engineering
 * estimates and items marked "derived" are worked out from other figures
 * here; neither is a measurement.
 */
(function () {
  'use strict';
  var PWC = (window.PWC = window.PWC || {});

  PWC.COLORS = {
    page: '#ff5630', // ~630 nm: memory page and optical write
    fluor: '#3be38f', // ~510 nm: indicator fluorescence
    excite: '#3aa0ff', // ~488 nm: indicator excitation
    record: '#b8f03c', // 532 nm: hologram recording
    medium: '#e8527a',
    gold: '#e0aa4a',
    accent: '#ff8fb5',
  };

  PWC.LEDE =
    'A small language model wrapped around a slab of living human neurons. Its fixed knowledge sits in a hologram and reaches the tissue as patterns of light.';

  PWC.LEGEND = [
    { color: 'page', text: '~630 nm  memory page, optical write' },
    { color: 'excite', text: '~488 nm  indicator excitation' },
    { color: 'fluor', text: '~510 nm  activity fluorescence' },
    { color: 'record', text: '532 nm  page recording (imprint only)' },
  ];
  PWC.SCALE_NOTE = 'Tissue is drawn 4× thick and one dot stands for about 4,000 neurons. Breadboard holes sit 25 mm apart.';
  PWC.TEACHER_LABEL = 'Digital teacher model';
  PWC.TODAY_LABEL = 'Unit sold today (size estimated): about 0.3 m, 30 W, under a million neurons';
  PWC.REF_LABEL = 'Electrode chip today, true size';

  PWC.STATUS = {
    demonstrated: { label: 'Demonstrated', gloss: 'Shown in a lab or sold as a product, at the scale stated.' },
    emerging: { label: 'Emerging', gloss: 'Shown at toy scale or in early papers.' },
    speculative: { label: 'Speculative', gloss: 'Not shown anywhere. Drawn here as a proposal.' },
  };

  PWC.INTRO = {
    title: 'A wetware co-processor with an optical memory',
    body: [
      'The starting idea was a language model imprinted into a biological CPU grown from stem cells, with optical memory so that only firing neurons draw power. This model draws the closest version that physics and current lab results allow.',
      'The model’s weights stay frozen in a holographic crystal. A slab of about 10 million stem-cell-derived neurons does one job in the loop. It mixes each incoming light pattern through its own wiring, and a trained read-out turns the response into the next token.',
    ],
    hint: 'Drag to orbit, scroll or pinch to zoom, and click a part for its numbers. Explode pulls the stack apart. Real-size unit shows the box that keeps a culture alive today. With the model focused, arrow keys turn it and + and - zoom.',
  };

  PWC.GROUPS = [
    { id: 'wet', title: 'Living core' },
    { id: 'optio', title: 'Optical interface' },
    { id: 'mem', title: 'Optical memory' },
    { id: 'elec', title: 'Electrical interface and control' },
  ];

  PWC.PARTS = [
    {
      id: 'tissue', group: 'wet', name: 'Neural tissue slab', short: 'Neural tissue', status: 'emerging', sw: 'var(--w-medium)',
      what: 'A sheet of human cortical neurons and supporting glia grown from induced pluripotent stem cells. It is the one living compute block in the design, a recurrent network that turns each incoming light pattern into a rich, fading response.',
      role: 'It works as a reservoir. Nobody can set individual synaptic weights in living tissue, so the language model is not copied into these cells. A trained read-out learns to use whatever dynamics this particular slab has.',
      facts: [
        ['Drawn size', '12 × 12 × 0.5 mm, about 10 million neurons'],
        ['Shown on a chip', 'about 1 million cells plated on a 3.85 × 2.10 mm array (2022)'],
        ['Thickness limit', '0.3 to 0.4 mm from a supply surface; less on a chip, which feeds from one side only'],
        ['Synapses per neuron', '100 to 400 in culture; 7,000 to 10,000 in adult cortex'],
        ['Power', '2 to 10 mW at in-brain rates of 0.2 to 1 nW per neuron; probably under 1 mW in culture, where it has never been measured'],
        ['Per synaptic event', '14 to 26 fJ (model estimate); a neuromorphic chip spends about 24 pJ'],
        ['Fading memory', 'about 1 s'],
        ['Service life', '3 to 6 months per vendors, after months of maturation; research cultures have passed a year'],
      ],
      scale: 'Drawn four times thicker than real so the network is visible. Each dot stands for about 4,000 neurons. Rose dots are excitatory cells. Violet dots are inhibitory cells, drawn at one in five; current stem-cell cultures have far fewer.',
    },
    {
      id: 'perfusion', group: 'wet', name: 'Perfusion capillaries', short: 'Capillaries', status: 'emerging', sw: 'var(--w-medium)',
      what: 'Printed micro-channels that carry oxygenated medium through the slab, standing in for blood vessels.',
      role: 'Without them a slab this size would have to stay under 0.3 mm thick and be fed from its faces. More firing raises oxygen demand, so busier tissue needs denser channels.',
      facts: [
        ['Shown in labs', 'printed grids at 250 µm spacing kept about 10 mm³ of neural tissue alive for 8 days (2023)'],
        ['Printable vessel diameter', '10 to over 70 µm'],
        ['Oxygen need', 'about 10 nmol O₂ per second for 5 mW of metabolism'],
        ['Real cortex', 'about 230 mm of vessel in every mm³, 5 to 15 times denser than printed grids'],
      ],
    },
    {
      id: 'chamber', group: 'wet', name: 'Culture chamber', short: 'Culture chamber', status: 'demonstrated', sw: '#cfe3ea',
      what: 'A sealed glass well that holds the slab in culture medium at body temperature and blood-like pH.',
      role: 'This wet cartridge, with the tissue and electrode array, is the consumable. It is swapped when the tissue ages out, and everything learned inside it is lost with it.',
      facts: [
        ['Conditions', '37 °C, 5% CO₂, pH near 7.4'],
        ['Medium change', 'every 24 to 48 h in current platforms'],
        ['Reference flow', '15 µL/min recirculating for 4 organoids'],
      ],
    },
    {
      id: 'lifesupport', group: 'wet', name: 'Life-support loop', short: 'Life support', status: 'demonstrated', sw: '#f0a9bd',
      what: 'Reservoir, pump and gas exchanger that keep the medium flowing, oxygenated and clean.',
      role: 'This is the part the original idea leaves out. It never switches off, and in current products it and the electronics draw about 100,000 times more power than the neurons do.',
      facts: [
        ['Unit sold today', 'about 30 W for 200,000 to 800,000 neurons (vendor and press figures)'],
        ['Its size', 'described as slightly larger than a shoebox; no official dimensions'],
        ['In the power budget', 'pumps and gas about 2 W (est.)'],
      ],
      scale: 'Drawn far smaller than any real unit. Press Real-size unit to see the box that keeps a culture alive today.',
    },
    {
      id: 'thermal', group: 'wet', name: 'Thermal stage', short: 'Thermal stage, 37 °C', status: 'demonstrated', sw: '#b9703a',
      what: 'A heated copper frame that holds the cartridge at 37 °C and spreads heat from the chip beneath the tissue.',
      role: 'Neurons cannot be power-gated. A neuron that stops metabolising dies within minutes, so heat and flow are permanent loads.',
      facts: [
        ['Set point', '37 °C'],
        ['In the power budget', 'about 3 W (est.)'],
      ],
    },
    {
      id: 'window', group: 'optio', name: 'Optical window', short: 'Optical window', status: 'demonstrated', sw: '#d8eef6',
      what: 'A glass cover that seals the wet chamber and lets light in and out.',
      role: 'Visible light scatters within roughly 50 to 100 µm of grey matter. That is a second reason, after oxygen, for keeping the slab thin.',
      facts: [['Thickness', '0.17 mm, a standard No. 1.5 coverslip']],
    },
    {
      id: 'ring', group: 'optio', name: 'Indicator excitation ring', short: 'Excitation ring', status: 'demonstrated', sw: 'var(--w-excite)',
      what: 'A ring of blue LEDs that lights the tissue so active cells can be seen.',
      role: 'The neurons carry a fluorescent activity indicator. Under blue light a cell glows green for a moment after it fires, which lets a camera read many cells at once.',
      facts: [
        ['Excitation', 'about 488 nm'],
        ['Emission', 'about 510 nm'],
        ['In the power budget', 'about 0.5 W while on (est.)'],
      ],
    },
    {
      id: 'lens', group: 'optio', name: 'Projection lens array', short: 'Lens array', status: 'emerging', sw: '#cfe2ff',
      what: 'A plate of micro-lenses that relays the memory page onto the tissue and gathers the fluorescence coming back.',
      role: 'It stands in for a microscope objective so the optical head can stay a few millimetres tall.',
      facts: [
        ['Drawn', '13 × 13 mm, 18 × 18 lenslets'],
        ['Light per evoked spike', '0.1 to 10 nJ at the cell for a light-gated channel that answers to blue light, not checked for the red-sensitive kind this design needs; the spike itself costs the cell 0.01 to 0.4 nJ'],
      ],
    },
    {
      id: 'dichroic', group: 'optio', name: 'Dichroic splitter', short: 'Dichroic splitter', status: 'demonstrated', sw: '#ff86d8',
      what: 'A glass cube with a colour-selective mirror on its diagonal. Red light from the memory passes straight down. Green fluorescence from the tissue is turned sideways to the imager.',
      facts: [
        ['Passes', 'red, about 630 nm'],
        ['Reflects', 'green, about 510 nm'],
        ['Drawn', '9 mm cube'],
      ],
    },
    {
      id: 'sensor', group: 'optio', name: 'Read-out imager', short: 'Read-out imager', status: 'emerging', sw: 'var(--w-fluor)',
      what: 'A lens and camera chip that photograph the fluorescing tissue many times a second.',
      role: 'The camera sees thousands of cells while the light writes to a few hundred spots, so the tissue handles one narrow step of the model.',
      facts: [
        ['Shown', 'light in and imaging out ran a spoken-digit classifier on cultured rat neurons (2023)'],
        ['In the power budget', 'about 4 W while reading (est.)'],
        ['Electrical route instead', '73 µW per channel, so 730 W to read all 10 million cells'],
      ],
    },
    {
      id: 'relay', group: 'optio', name: 'Relay lens', short: 'Relay lens', status: 'demonstrated', sw: '#e6f3ff',
      what: 'A lens that images the page leaving the crystal onto the lens array.',
      facts: [['Drawn', '9 mm across']],
    },
    {
      id: 'crystal', group: 'mem', name: 'Holographic memory crystal', short: 'Holographic memory', status: 'emerging', sw: '#e8922a',
      what: 'A crystal of iron-doped lithium niobate. Data pages are stored through the same volume as overlapping holograms, each recorded at its own beam angle.',
      role: 'It holds the frozen part of the language model: embeddings and weight matrices. In the simplified picture drawn here, lighting it at one angle makes one page come out as a pattern of light, which goes straight down to the tissue. Holding the data costs no power, but the capacity shown so far is megabytes.',
      facts: [
        ['Standby power', '0 W'],
        ['Most pages shown', '10,000 in one 10 × 10 × 20 mm bar, at about 2,000 bits a page'],
        ['Best density shown', 'about 0.01 TB/cm³: 705 pages, 51 MB, in 5.4 mm³ (2024)'],
        ['For comparison', 'laser-written fused silica 0.2 TB/cm³; packaged flash 1 to 12 TB/cm³'],
        ['Read energy', 'about 16 nJ of light per bit; an SSD spends about 1 nJ'],
        ['Brightness per page', 'falls with the square of the number of pages stored; at 10,000 pages each page returned about 5 billionths of the laser light'],
        ['Reading', 'erases pages unless they are fixed, which has been shown only for 2,000-bit pages. Reading in red, as drawn, avoids erasure but brings back only a strip of each page per mirror angle'],
        ['Lifetime', 'months to years by extrapolation, not checked against a primary source; laser-written borosilicate glass, at about 0.085 TB/cm³, is projected past 10,000 years from accelerated ageing'],
      ],
      scale: 'Drawn as a 10 mm cube holding nine sheets. Lab crystals are 10 × 10 × 20 mm bars, and real holograms fill the whole volume and overlap.',
    },
    {
      id: 'laser', group: 'mem', name: 'Reference laser and steering mirror', short: 'Reference laser', status: 'demonstrated', sw: 'var(--w-page)',
      what: 'A laser diode and a small tilting mirror. The mirror angle chooses which page the crystal gives back.',
      role: 'This is the memory’s address line. The laser is dark between reads.',
      facts: [
        ['Wavelength', 'about 630 nm red for reading; recording needs 532 nm green in both the page beam and this reference path, from a separate laser that is not drawn'],
        ['Addressing', 'one mirror angle per page when read at the recording colour, 0.007° apart in lab systems; a red read needs several angles per page'],
        ['Stability needed', 'about 10 µrad, so the mount and crystal temperature must hold still'],
        ['In the power budget', 'about 3 W while reading (est.)'],
      ],
    },
    {
      id: 'slm', group: 'mem', name: 'Page composer', short: 'Page composer', status: 'demonstrated', sw: 'var(--w-record)',
      what: 'A spatial light modulator, a tiny reflective display. It shapes a laser beam into one page of data at a time so the page can be recorded in the crystal.',
      role: 'Used only while imprinting. During normal running it is dark.',
      facts: [
        ['Typical device', '1920 × 1080 pixels at 8 µm pitch, 15 × 9 mm'],
        ['Recording light', 'green, 532 nm'],
        ['In the power budget', 'about 10 W while writing (est.)'],
      ],
    },
    {
      id: 'mea', group: 'elec', name: 'High-density electrode array', short: 'Electrode array', status: 'emerging', sw: 'var(--w-gold)',
      what: 'A CMOS chip whose surface is covered in microscopic electrodes. Each one listens to the neurons resting on it, and a few can stimulate.',
      role: 'It gives a second, electrical read-out beside the imager. Electrodes hear whole neurons and never single synapses, which is one reason weights cannot be written in.',
      facts: [
        ['Reference chip', '26,400 electrodes at 17.5 µm pitch on 3.85 × 2.10 mm'],
        ['Read at once', 'about 1,020 channels; a lower-density chip reads all 4,096'],
        ['Hears', 'neurons within about 50 to 100 µm of the surface'],
        ['Stimulation', 'up to 32 channels'],
        ['Power', '75 mW per chip, 73 µW per channel'],
        ['Drawn here', '12 × 12 mm, about 18 reference chips tiled'],
      ],
      scale: 'Each gold dot stands for about 300 electrodes. Tiling to this area has not been done.',
    },
    {
      id: 'asic', group: 'elec', name: 'Control silicon', short: 'Control silicon', status: 'demonstrated', sw: '#30323d',
      what: 'A conventional processor. It turns text into tokens, picks which memory page to read, detects spikes, runs the trained read-out and samples the next token.',
      role: 'It is the largest single draw in the power budget. It also tracks drift in the tissue and refits the read-out every few minutes to hours.',
      facts: [
        ['In the power budget', 'controller about 30 W, spike detection about 5 W (est.)'],
        ['Token clock', '2 to 10 tokens per second, set by the tissue (derived)'],
        ['Also holds', 'the context and the read-out weights, which change and need ordinary rewritable memory'],
      ],
    },
    {
      id: 'board', group: 'elec', name: 'Carrier board', short: 'Carrier board', status: 'demonstrated', sw: '#12332f',
      what: 'A printed circuit board that carries power and data between the cartridge, the optics and the control silicon.',
      facts: [['Drawn', '46 × 36 mm']],
    },
  ];

  PWC.RUN = {
    intro: 'Slowed 20 to 100 times. A real cycle would take 0.1 to 0.5 s, which caps this design near 2 to 10 tokens per second.',
    period: 11,
    prompt: 'A memory is',
    tokens: ['a', 'pattern', 'that', 'light', 'can', 'wake', 'up', 'again', '.'],
    steps: [
      { id: 'address', t0: 0, t1: 1.1, title: 'Pick the page', focus: ['asic', 'laser'],
        body: 'Control silicon turns the latest token into a page address and tilts the steering mirror to that angle.',
        power: 'Silicon: about 35 W, always on (est.)' },
      { id: 'read', t0: 1.1, t1: 2.6, title: 'Read the hologram', focus: ['laser', 'crystal'],
        body: 'The reference laser switches on. The crystal answers with one stored page, a grid of bright and dark spots, which travels down the column.',
        power: 'Laser: about 3 W while on (est.), near 16 nJ of light per bit read. Holding the page cost 0 W.' },
      { id: 'write', t0: 2.6, t1: 3.6, title: 'Write with light', focus: ['tissue', 'lens'],
        body: 'The page lands on the tissue. Neurons under the bright spots carry a light-gated channel, and they fire.',
        power: '0.1 to 10 nJ of light per evoked spike (a figure for a blue-sensitive channel, not checked for red). The spike itself costs the cell 0.01 to 0.4 nJ. A crystal holding thousands of pages returns too little light for this; it needs far fewer pages stored at each place in the crystal, or far more laser power (derived).' },
      { id: 'compute', t0: 3.6, t1: 5.6, title: 'Tissue mixes the pattern', focus: ['tissue'],
        body: 'With the light off, activity spreads through the slab’s own wiring and fades within about a second. This is the only step the neurons do.',
        power: '14 to 26 fJ per synaptic event (model estimate). A third or more of the tissue’s energy is spent whether or not it fires.' },
      { id: 'readout', t0: 5.6, t1: 7.6, title: 'Read the response', focus: ['sensor', 'mea', 'ring'],
        body: 'Blue light makes active cells glow green. The imager photographs them from above while the electrode array listens from below.',
        power: 'Imager 4 W, excitation 0.5 W (est.); electrode chips about 1.4 W' },
      { id: 'decode', t0: 7.6, t1: 8.8, title: 'Decode a token', focus: ['asic'],
        body: 'A linear read-out, trained for this particular slab, turns the activity picture into scores for the next token. Silicon samples one.',
        power: 'The read-out weights sit in ordinary rewritable memory beside the controller, because they are refit as the tissue drifts.' },
      { id: 'rest', t0: 8.8, t1: 11, title: 'Between tokens', focus: ['lifesupport', 'thermal'],
        body: 'Lasers and LEDs are dark and the memory draws nothing. Pumps, heater, electrode chips and controller keep running.',
        power: 'About 47 W continues (est.)' },
    ],
  };

  PWC.IMPRINT = {
    intro: 'Copying trained weights into synapses is not possible. There is no write head: 8 to 59 stimulation sites face tens to hundreds of millions of synapses. This pipeline is the nearest route built from steps that have some lab evidence.',
    note: 'Each step plays for 6 to 11 s.',
    steps: [
      { id: 'compress', fx: 'distill', dur: 6, status: 'demonstrated', focus: ['asic'], title: 'Compress the model',
        body: 'Distil and quantise the digital model into a small, sparse, spiking-style student. This happens entirely in silicon.',
        gap: 'Shown: spiking language models of 46 to 216 million parameters, in silicon only' },
      { id: 'freeze', fx: 'record', dur: 9, status: 'speculative', focus: ['slm', 'crystal', 'laser'], title: 'Freeze the knowledge into the crystal',
        body: 'Record embeddings, weight matrices and the unembedding as holographic pages, one beam angle per page. One block of the model is left out, for the tissue to do.',
        gap: 'Shown: about 51 MB in one storage spot, in pages that fade as they are read and have to be rewritten. The step 1 students need about 25 to 110 MB at 4 bits; an 8-billion-parameter model needs about 4 GB, some 80 such spots.' },
      { id: 'grow', fx: 'grow', dur: 8, status: 'emerging', focus: ['tissue', 'perfusion'], title: 'Grow and mature the tissue',
        body: 'Stem cells become cortical neurons and glia, settle on the electrode array as a thin slab and wire themselves up over two to six months.',
        gap: 'Shown: about 1 million cells plated on 8 mm². A perfused 10-million-neuron slab is not.' },
      { id: 'probe', fx: 'probe', dur: 7, status: 'emerging', focus: ['tissue', 'sensor', 'mea'], title: 'Characterise this slab',
        body: 'Play many light patterns and record every response to build a digital twin. No two tissues are wired alike, so this is done for each one.',
        gap: 'Shown at small scale, with electrodes and with light' },
      { id: 'fit', fx: 'calibrate', dur: 7, status: 'speculative', focus: ['asic', 'sensor'], title: 'Fit the read-out',
        body: 'Train a linear read-out and input encoder so the tissue’s responses reproduce the teacher model’s activations. The learning lands in the read-out, which is kept in rewritable silicon memory.',
        gap: 'Shown: 78% on an 8-speaker vowel task (chance 12.5%). It started at 51% and rose over two days of stimulation that changed the organoid itself. Nothing with language.' },
      { id: 'shape', fx: 'train', dur: 9, status: 'speculative', focus: ['tissue', 'lens'], title: 'Shape the tissue in closed loop',
        body: 'Reward wanted responses with predictable stimulation and nudge connections with paired pulses. This is the only step that sets out to change the neurons themselves.',
        gap: 'Shown: slightly longer Pong rallies after 5 minutes of play; a cart-pole gain that faded after 45 minutes of rest' },
      { id: 'run', fx: 'run', dur: 11, status: 'speculative', focus: ['chamber', 'lifesupport'], title: 'Run, recalibrate, replace',
        body: 'Generate at 2 to 10 tokens per second. Refit the read-out as the tissue drifts, swap the cartridge after three to six months, then repeat steps 3 to 6.',
        gap: 'No neural culture has produced a single token' },
    ],
  };

  PWC.POWER = {
    title: 'Where the watts go',
    intro: 'An illustrative lean budget for this one module adds up to about 65 W with every item switched on. While generating it draws about 50 W: the page composer (10 W) runs only at imprint, and the laser, imager and LEDs are each on for only part of a cycle. It has not been checked against hardware. The tissue is the two rose rows at the top, and items marked est. are engineering estimates.',
    min: 1e-5,
    max: 100,
    ticks: [1e-5, 1e-3, 1, 100],
    actRef: 0.02,
    key: 'Dot: draw right now. Tick: draw when switched on. A hollow dot at the left edge means off.',
    items: [
      { id: 'fire', name: 'Tissue, firing', group: 'tissue', peak: 2.5e-3, mode: 'fire', note: 'The part that scales with activity: 13 to 60% of neural energy in budget models. The two tissue rows together are drawn at about 0.55 nW per neuron, mid-range of in-brain rates; likely lower in culture.' },
      { id: 'keep', name: 'Tissue, upkeep', group: 'tissue', peak: 3e-3, mode: 'const', note: 'Resting potentials, housekeeping and glia. Spent whether or not cells fire. The two tissue rows together are drawn at about 0.55 nW per neuron, mid-range of in-brain rates; likely lower in culture.' },
      { id: 'led', name: 'Excitation LEDs (est.)', peak: 0.5, mode: 'excite', note: 'On only during read-out' },
      { id: 'mea', name: 'Electrode chips', peak: 1.35, mode: 'const', note: '18 chips at 75 mW each (about 18,400 channels), scaled from a measured chip' },
      { id: 'pump', name: 'Pumps and gas (est.)', peak: 2, mode: 'const', note: 'Never off' },
      { id: 'heat', name: 'Heater (est.)', peak: 3, mode: 'const', note: 'Never off' },
      { id: 'laser', name: 'Memory lasers (est.)', peak: 3, mode: 'ref', note: 'Red while a page is read; a green laser of similar power while a page is recorded' },
      { id: 'cam', name: 'Imager (est.)', peak: 4, mode: 'imager', note: 'On only during read-out' },
      { id: 'acq', name: 'Spike detection (est.)', peak: 5, mode: 'const', note: 'Acquisition logic for the electrode chips' },
      { id: 'psu', name: 'Supply loss (est.)', peak: 6, mode: 'const', note: 'Conversion losses' },
      { id: 'slm', name: 'Page composer (est.)', peak: 10, mode: 'slm', note: 'On only while imprinting' },
      { id: 'ctl', name: 'Controller (est.)', peak: 30, mode: 'const', note: 'Conventional computer running the loop' },
    ],
    claims: [
      { q: '“Only firing neurons take power”', verdict: 'Mostly wrong', fill: 20,
        a: [
          'Inside the tissue, energy-budget models put 40 to 87% of the cost in resting potentials, housekeeping and glia, spent whether or not a cell fires. A rat brain made electrically silent still used a third to a half of its normal ATP.',
          'Around the tissue, life support and electronics never stop. The unit sold today is reported to draw about 30 W to keep well under a milliwatt of neurons alive.',
          'What survives: one synaptic event is estimated at 14 to 26 fJ, about a thousand times less than the same event on a neuromorphic chip. The two are not equal in precision or speed.',
        ] },
      { q: '“Optical memory uses very little power”', verdict: 'True to hold, costly to use', fill: 50,
        a: [
          'Holding data in glass or a crystal costs 0 W. Flash and tape also hold data unpowered, and holding weights in DRAM is about 0.1% of inference power anyway.',
          'Using the memory is where the energy goes. A holographic crystal needs about 16 nJ of light per bit read, where an SSD spends about 1 nJ, and the laser and camera draw watts.',
          'What survives: let the hologram act as a fixed weight matrix so the lookup happens in light. Lab optics have multiplied with less than one detected photon per weight. That counts only the light reaching the detector, and the weights sat on a powered display. A passive store and a low-energy multiplier have not been shown in one device.',
        ] },
      { q: '“Memory can be hyper-optimised”', verdict: 'On lifetime, not on density', fill: 35,
        a: [
          'A holographic crystal has shown about 0.01 TB/cm³ and laser-written fused silica about 0.2. Packaged flash already holds 1 to 12 TB/cm³.',
          'Glass wins on lifetime: a borosilicate version of the laser-written glass, at about 0.085 TB/cm³, is projected past 10,000 years. A crystal’s pages are extrapolated to last months to years, about as long as unpowered flash.',
        ] },
    ],
    compareNote: 'At about 50 W this module would need 14 to 100 tokens per second to match GPUs. Its tissue caps it near 2 to 10.',
    compare: {
      head: ['System', 'Energy per token'],
      rows: [
        ['This module at about 50 W, if it reached 5 tokens/s', 'about 10 J'],
        ['Whole human brain, speaking', 'about 6 J'],
        ['Frontier model on GPUs (modelled)', 'about 3.7 J'],
        ['70B-parameter model on GPUs', '0.5 to 1.1 J'],
        ['370M-parameter model on neuromorphic chips (authors’ estimate)', '0.4 J'],
        ['Any neural culture so far', 'no tokens yet'],
      ],
    },
  };

  PWC.REALITY = {
    intro: 'Every part and step carries one of three tags. This is the evidence behind them.',
    sections: [
      { title: 'Shown today', status: 'demonstrated', items: [
        'A dish plated with about 1 million stem-cell-derived cells played slightly longer Pong rallies after its first five minutes of play (Kagan 2022). The effect is small and its meaning is disputed.',
        'One organoid used as a reservoir, with the only supervised training in a silicon read-out, reached 78% on an 8-speaker vowel task where chance is 12.5% (Cai 2023).',
        'Cultured rat neurons with light going in and imaging coming out worked as a reservoir that classified spoken digits (Sumi 2023).',
        'A self-contained unit with 59 electrodes and a reported 200,000 to 800,000 human neurons is on sale. Its maker quotes up to six months of culture life.',
        'Ten thousand holographic pages have been stored in one 2 cm³ crystal, at about 2,000 bits a page. In glass, 4.84 TB has been written into a plate that holds it at 0 W.',
      ] },
      { title: 'Early evidence', status: 'emerging', items: [
        'Printed capillary grids kept about 10 mm³ of stem-cell-derived neural tissue alive for 8 days. Its activity was not recorded.',
        'Closed-loop training improved a cart-pole task, and the gain was gone after 45 minutes of rest.',
        'Holographic light patterns have driven about 400 chosen neurons in one culture, one at a time.',
        'Optical matrix multiplication has worked with less than one detected photon per weight, not counting the laser, display or camera, and with the weights held on a powered display.',
        'A 370-million-parameter language model has been mapped onto neuromorphic chips, estimated by its authors at about 0.4 J per token.',
      ] },
      { title: 'Not shown anywhere', status: 'speculative', items: [
        'Writing a chosen set of weights into living synapses. Electrodes and light reach whole cells, never chosen synapses. The best-known systems, from the Pong-playing dish to the unit on sale, stimulate through 8 to 59 electrode sites, and lab optics have addressed about 400 cells one at a time.',
        'Running any pretrained network, of any size, in tissue. No culture has produced a token.',
        'A perfused 10-million-neuron slab on a tiled electrode array that behaves the same way for months.',
        'A hologram whose read-out page is used directly as the stimulus for tissue.',
        'A holographic store that holds a language model. One storage spot has held about 51 MB, in pages that had to be refreshed.',
      ] },
      { title: 'What the idea gets right', items: [
        'Neural tissue is extremely cheap per event, and it adapts on its own.',
        'Tissue is the wrong place to keep anything permanent. Synaptic proteins turn over in days and trained behaviour has faded within an hour, so a separate non-volatile memory is the right call.',
        'Light is a good bus to and from neurons because it reaches many cells at once without wires.',
      ] },
      { title: 'People, consent and limits', items: [
        'The neurons come from a human donor’s cells and carry that person’s genome. Most existing consent did not foresee commercial computing.',
        'Ten million neurons is about a seventh of a mouse brain. On paper, matching a 100-billion-parameter model one synapse per weight would take about four mouse brains of cultured neurons.',
        'The field’s own roadmap asks for ethics oversight embedded in the work, and the Baltimore Declaration (2023) flags the cell donor’s rights and the question of consciousness.',
      ] },
    ],
    sources: [
      { t: 'Kagan et al. 2022, Neuron. In vitro neurons learn and exhibit sentience when embodied in a simulated game-world', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9747182/' },
      { t: 'Cai et al. 2023, Nature Electronics. Brain organoid reservoir computing', u: 'https://doi.org/10.1038/s41928-023-01069-w' },
      { t: 'Robbins et al. 2026, Cell Reports. Closed-loop training of cortical organoids on cart-pole', u: 'https://doi.org/10.1016/j.celrep.2026.116984' },
      { t: 'Smirnova et al. 2023, Frontiers in Science. Organoid intelligence roadmap', u: 'https://doi.org/10.3389/fsci.2023.1017235' },
      { t: 'Jordan et al. 2024, Frontiers in AI. FinalSpark Neuroplatform', u: 'https://doi.org/10.3389/frai.2024.1376042' },
      { t: 'IEEE Spectrum 2025. Biological computer for sale (Cortical Labs CL1)' },
      { t: 'Sumi et al. 2023, PNAS. Reservoir computing in cultured neurons with optical input and read-out', u: 'https://doi.org/10.1073/pnas.2217008120' },
      { t: 'Schmieder et al. 2022, Life Science Alliance. Holographic stimulation of single neurons on electrode arrays', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9008225/' },
      { t: 'Grebenyuk et al. 2023, Nature Communications. Perfused printed capillaries in neural tissue', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9837048/' },
      { t: 'Howarth, Gleeson and Attwell 2012, JCBFM. Updated energy budgets for neural computation', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3390818/' },
      { t: 'Du et al. 2008, PNAS. Brain ATP use at the electrically silent state', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2359810/' },
      { t: 'Herculano-Houzel 2011, PLoS ONE. Energy budget per neuron', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3046985/' },
      { t: 'Bartol et al. 2015, eLife. About 4.7 bits per synapse', u: 'https://elifesciences.org/articles/10778' },
      { t: 'Lennie 2003, Current Biology. The cost of cortical computation', u: 'https://doi.org/10.1016/S0960-9822(03)00135-0' },
      { t: 'Project Silica 2026, Nature. Laser writing in glass for archival data storage', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12916313/' },
      { t: 'Burr, An, Mok and Psaltis 1995, Proc. SPIE 2514. Large-scale rapid access holographic memory', u: 'https://www.epfl.ch/labs/lo/wp-content/uploads/2018/08/SPIE_2514_363_1995.pdf' },
      { t: 'An, Psaltis and Burr 1999, Applied Optics. Thermal fixing of 10,000 holograms in LiNbO₃:Fe', u: 'https://doi.org/10.1364/AO.38.000386' },
      { t: 'Chu et al. 2024, Communications Engineering. Holographic storage for the cloud assessed end to end', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11189537/' },
      { t: 'Oviedo et al. 2025, arXiv. Energy use of AI inference', u: 'https://arxiv.org/abs/2509.20241' },
      { t: 'Abreu et al. 2025, arXiv. Language model on Loihi 2', u: 'https://arxiv.org/abs/2503.18002' },
      { t: 'Zhu et al. 2023, arXiv. SpikeGPT', u: 'https://arxiv.org/abs/2302.13939' },
      { t: 'Davies et al. 2018, IEEE Micro. Loihi' },
      { t: 'Merolla et al. 2014, Science. TrueNorth' },
      { t: 'Wang et al. 2022, Nature Communications. Optical neural network below one photon per multiplication', u: 'https://doi.org/10.1038/s41467-021-27774-8' },
      { t: 'Hartung et al. 2023, Frontiers in Science. Baltimore Declaration toward organoid intelligence', u: 'https://doi.org/10.3389/fsci.2023.1068159' },
      { t: 'Ballini et al. 2014, IEEE JSSC. A 1024-channel CMOS microelectrode array with 26,400 electrodes', u: 'https://doi.org/10.1109/JSSC.2014.2359219' },
      { t: 'MaxWell Biosystems, MaxOne high-density electrode array specifications', u: 'https://www.mxwbio.com/products/maxone-mea-system-microelectrode-array/' },
    ],
  };
})();
