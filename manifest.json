const FLOORS = [
  {code:'GF', name:'Ground Floor', rooms:[
    ['ENT','Entrance Lobby'],['HAL','Hall'],['CLK','Cloaks'],['WC','WC'],
    ['SIT','Sitting Room'],['DIN','Dining Room'],['KIT','Kitchen'],['PAN','Pantry'],
    ['UTY','Utility'],['BOO','Boot Room'],['PLY','Playroom'],['GYM','Gym'],
    ['SHR','Shower Room'],['STO','Storage'],['GAR','Garage'],['TER','Terrace'],
    ['PLT','Plant Room'],
    ['SNU','Snug'],['SPL','Spiral Lobby'],['FPA','Firepit Area']
  ]},
  {code:'1F', name:'First Floor', rooms:[
    ['GAL','First Floor Gallery'],
    ['MBD','Master Bedroom'],['MD1','Master Dressing Room 1'],['MD2','Master Dressing Room 2'],['MEN','Master Ensuite'],
    ['BD2','Bedroom 2'],['D2','Bedroom 2 Dressing Room'],['EN2','Bedroom 2 Ensuite'],
    ['BD3','Bedroom 3'],['EN3','Bedroom 3 Ensuite'],
    ['BD4','Bedroom 4'],['D4','Bedroom 4 Dressing Room'],
    ['BD5','Bedroom 5'],
    ['FBA','Family Bathroom (Bed 4 & 5)'],
    ['PLD','Plant & Data Room'],
    ['STD','Study'],
    ['BL1','Balcony'],
    ['SPD','Spiral Landing'],['FHL','First Floor Hallway'],['FLD','First Floor Landing']
  ]},
  {code:'2F', name:'Second Floor', rooms:[
    ['BD6','Bedroom 6'],['W6','Bedroom 6 Wardrobe Room'],
    ['BD7','Bedroom 7'],['W7','Bedroom 7 Wardrobe Room'],
    ['BA2','Bathroom'],
    ['GAL2','Second Floor Gallery']
  ]},
  {code:'WH', name:'Whole House / External', rooms:[
    ['STR','Staircase'],['ROF','Roof'],['EXT','External Walls & Brickwork'],
    ['WIN','Windows & External Doors'],['LAN','Landscaping & External Works'],
    ['ELE','M&E — Electrical'],['PLM','M&E — Plumbing'],
    ['SMH','M&E — Smart Home / AV / Security / Network'],['HVA','M&E — Heating / Air Con / MVHR']
  ]}
];

const TRADES = [
  'Structural / Building','Roofing & Leadwork','Windows & External Doors','Joinery & Internal Doors',
  'Staircase','Plastering & Drylining','Tiling','Flooring','Decoration / Painting',
  'Plumbing & Sanitaryware','Electrical','Smart Home / AV / Security / Network',
  'Heating / Air Con / MVHR','Kitchen & Fitted Furniture','External Works / Landscaping','General / Cleaning & Finishing'
];

const CHECKLISTS = {
  'Structural / Building':'Cracks in walls/ceilings, movement at junctions, exposed or damaged blockwork, wall plumb & level.',
  'Roofing & Leadwork':'Flashing and lead dressing, tile/slate alignment, gutter falls & joints, rooflight seals, ridge/hip finish.',
  'Windows & External Doors':'Smooth opening/closing, draughts, locking action, seals intact, mastic finish neat, glazing undamaged.',
  'Joinery & Internal Doors':'Door alignment & clearance, ironmongery operates smoothly, architrave/skirting mitres and fixing, no visible fixings.',
  'Staircase':'Handrail firmly fixed, baluster spacing safe, no squeaks, tread/nosing finish, newel post fixing.',
  'Plastering & Drylining':'Cracks, blown or hollow-sounding plaster, uneven skim, nail pops, corner bead straightness.',
  'Tiling':'Lippage between tiles, grout lines consistent, no cracked/chipped tiles, trims and beading neat, silicone joints.',
  'Flooring':'Gaps or movement between boards/tiles, scratches, level across the room, threshold/transition strips secure.',
  'Decoration / Painting':'Even coverage (no patchiness), no drips or runs, crisp cutting-in at ceilings/skirtings, colour consistency room to room.',
  'Plumbing & Sanitaryware':'No leaks under sinks/behind WCs, water pressure & drainage, sealant neat, taps/mixers operate smoothly, waste flow.',
  'Electrical':'Sockets/switches function & sit flush, faceplates aligned, light fittings secure & correct, dimmers work, consumer unit labelled.',
  'Smart Home / AV / Security / Network':'App/keypad control works as specified, CCTV coverage & recording, WiFi coverage room to room, scenes/automations correct.',
  'Heating / Air Con / MVHR':'UFH zones reach set temperature, thermostats respond, air con airflow & noise, MVHR balanced and filters accessible.',
  'Kitchen & Fitted Furniture':'Door/drawer alignment & soft-close, worktop joints, appliance fit and function, handle fixing.',
  'External Works / Landscaping':'Paving falls away from house, drainage clear, planting as specified, gates/fences operate correctly.',
  'General / Cleaning & Finishing':'Builders clean complete, no residual dust/debris, protective film removed, snags list closed out.'
};

const ROOM_ZOOM_OVERRIDES = {
  GF: {KIT:1.2, SNU:1.2, GAR:1.2, PLY:1.2, HAL:1.2, SIT:1.2, DIN:1.2},
  '1F': {BD5:1, BD3:1.2, BD2:1.2},
  '2F': {BD6:1.2, BD7:1.2}
};

const PIN_COORDS = {
  'GF': [
    ['ENT',54.11,81.66],
    ['HAL',54.15,71.77],
    ['CLK',62.8,73.79],
    ['WC',64.34,63.97],
    ['SIT',69.35,46.82],
    ['DIN',54.49,46.94],
    ['KIT',28.39,31.62],
    ['PAN',31.56,49.12],
    ['UTY',15.3,28.46],
    ['BOO',27.53,57.53],
    ['PLY',43.71,72.63],
    ['GYM',73.54,72.01],
    ['SHR',36.61,47.42],
    ['STO',14.69,39.1],
    ['GAR',30.68,73.62],
    ['TER',50.13,24.01],
    ['PLT',27.45,49.37],
    ['SNU',43.41,46.94],
    ['SPL',36.02,55.02],
    ['FPA',61.88,14.03],
  ],
  '1F': [
    ['GAL',53.58,75.22],
    ['MBD',72.12,42.67],
    ['MD1',62.41,46.27],
    ['MD2',73.16,58.15],
    ['MEN',73.16,65.82],
    ['BD2',52.9,39.1],
    ['D2',61.46,36.61],
    ['EN2',62.15,28.83],
    ['BD3',42.66,38.98],
    ['EN3',33.92,40.33],
    ['PLD',27.45,40.71],
    ['BD4',44.5,59.54],
    ['D4',38.64,64.46],
    ['FBA',38.99,57.41],
    ['BD5',31.07,58.47],
    ['STD',63.05,60.84],
    ['BL1',72.29,29.57],
    ['SPD',35.19,49.79],
    ['FHL',46.01,51.46],
    ['FLD',53.23,53.71],
  ],
  '2F': [
    ['BD6',42.24,53.71],
    ['W6',33.26,53.71],
    ['BA2',51.22,48.49],
    ['BD7',61.79,53],
    ['W7',71.28,53.6],
    ['GAL2',52.14,56.92],
  ]
};
