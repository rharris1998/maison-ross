// 122 Glenview, traced from the estate agent's floorplan (EweMove / Giraffe360).
// Metres. x runs front (street, x=0) to back (garden), z runs along the
// house from the top of the plan to the bottom. Each room is a polygon of
// [x, z] points; doors and windows are wall segments [x1, z1, x2, z2].
// The plan says it is not to scale, so every floor is fitted to the ground
// floor's 8.1 m x 5.7 m footprint.
export const HOUSE = {
  footprint: {w: 8.1, d: 5.68},
  floors: [
    {
      id: 'ground', name: 'Ground', height: 2.45,
      rooms: [
        {id: 'living', name: 'Living room', area: ['living_room'], floor: 'wood',
          poly: [[0.25, 0.25], [4.34, 0.25], [4.34, 3.62], [0.25, 3.62]],
          furniture: [
            {t: 'tv', x: 2.3, z: 0.47, w: 1.7, d: 0.42},
            {t: 'rug', x: 2.3, z: 1.85, w: 2.2, d: 1.5},
            {t: 'coffee', x: 2.3, z: 1.85, w: 1.0, d: 0.55},
            {t: 'sofa', x: 2.3, z: 3.08, w: 2.3, d: 0.9, back: 's'},
            {t: 'armchair', x: 0.85, z: 1.8, w: 0.85, d: 0.85, back: 'w'},
            {t: 'plant', x: 3.95, z: 0.6, w: 0.45, d: 0.45},
          ]},
        {id: 'kitchen', name: 'Kitchen diner', area: ['kitchen', 'dining_room'], floor: 'tile',
          poly: [[4.48, 0.25], [7.87, 0.25], [7.87, 5.43], [5.39, 5.43], [5.39, 3.62], [4.48, 3.62]],
          furniture: [
            {t: 'counter', x: 6.17, z: 0.55, w: 3.38, d: 0.6},
            {t: 'counter', x: 5.69, z: 4.53, w: 0.6, d: 1.8},
            {t: 'counter', x: 7.57, z: 4.25, w: 0.6, d: 2.36},
            {t: 'table', x: 6.15, z: 2.15, w: 1.6, d: 0.9},
            {t: 'chair', x: 5.75, z: 1.45, w: 0.45, d: 0.45}, {t: 'chair', x: 6.55, z: 1.45, w: 0.45, d: 0.45},
            {t: 'chair', x: 5.75, z: 2.85, w: 0.45, d: 0.45}, {t: 'chair', x: 6.55, z: 2.85, w: 0.45, d: 0.45},
          ]},
        {id: 'hall', name: 'Hallway', area: ['hallway'], floor: 'wood',
          poly: [[0.88, 3.75], [5.3, 3.75], [5.3, 5.43], [0.88, 5.43]]},
        {id: 'porch', name: 'Porch', area: ['porch'], floor: 'tile',
          poly: [[0.05, 3.8], [0.8, 3.8], [0.8, 5.63], [0.05, 5.63]]},
      ],
      stairs: [{x1: 2.78, z1: 4.51, x2: 4.06, z2: 5.43, run: 'x'}],
      doors: [[3.05, 3.68, 3.87, 3.68], [4.57, 3.68, 5.3, 3.68], [0.84, 3.9, 0.84, 4.65], [0.05, 4.05, 0.05, 5.4]],
      windows: [[0.25, 0.55, 0.25, 3.3], [7.87, 0.6, 7.87, 2.7], [7.87, 3.55, 7.87, 5.2]],
    },
    {
      id: 'first', name: 'First', height: 2.4,
      rooms: [
        {id: 'dressing', name: 'Dressing room', area: ['dressing_room'], floor: 'carpet',
          poly: [[0.3, 0.26], [4.0, 0.26], [4.0, 3.49], [0.3, 3.49]],
          furniture: [
            {t: 'wardrobe', x: 2.15, z: 0.56, w: 3.4, d: 0.6},
            {t: 'rug', x: 2.15, z: 2.1, w: 1.6, d: 1.1},
            {t: 'ottoman', x: 2.15, z: 2.1, w: 0.9, d: 0.5},
            {t: 'mirror', x: 0.4, z: 2.6, w: 0.08, d: 0.8},
          ]},
        {id: 'spare', name: 'Spare bedroom', area: ['spare_bedroom'], floor: 'carpet',
          poly: [[4.19, 0.26], [7.83, 0.26], [7.83, 3.49], [4.19, 3.49]],
          furniture: [
            {t: 'bed', x: 6.0, z: 1.3, w: 1.45, d: 2.05, back: 'n'},
            {t: 'side', x: 5.0, z: 0.5, w: 0.42, d: 0.4}, {t: 'side', x: 7.0, z: 0.5, w: 0.42, d: 0.4},
          ]},
        {id: 'office', name: 'Office', area: ['office'], floor: 'wood',
          poly: [[0.3, 3.61], [2.95, 3.61], [2.95, 5.44], [0.3, 5.44]],
          furniture: [
            {t: 'desk', x: 0.65, z: 4.5, w: 0.65, d: 1.4},
            {t: 'chair', x: 1.25, z: 4.5, w: 0.5, d: 0.5},
            {t: 'shelf', x: 2.2, z: 3.8, w: 1.2, d: 0.32},
          ]},
        {id: 'landing', name: 'Landing', area: ['landing'], floor: 'carpet',
          poly: [[3.1, 3.61], [5.87, 3.61], [5.87, 5.44], [3.1, 5.44]]},
        {id: 'bath1', name: 'Bathroom', area: ['bathroom'], floor: 'tile',
          poly: [[6.0, 3.61], [7.83, 3.61], [7.83, 5.44], [6.0, 5.44]],
          furniture: [
            {t: 'bath', x: 6.92, z: 5.06, w: 1.7, d: 0.72},
            {t: 'toilet', x: 7.5, z: 3.95, w: 0.4, d: 0.6},
            {t: 'basin', x: 6.4, z: 3.85, w: 0.55, d: 0.42},
          ]},
      ],
      stairs: [{x1: 3.3, z1: 4.4, x2: 5.75, z2: 5.38, run: 'x'}],
      doors: [[3.15, 3.55, 3.95, 3.55], [4.25, 3.55, 5.05, 3.55], [3.02, 3.7, 3.02, 4.45], [5.94, 3.7, 5.94, 4.45]],
      windows: [[0.3, 0.6, 0.3, 3.1], [0.3, 3.85, 0.3, 5.2], [7.83, 0.6, 7.83, 3.1], [7.83, 3.95, 7.83, 5.05]],
    },
    {
      id: 'loft', name: 'Loft', height: 2.25,
      rooms: [
        {id: 'main', name: 'Main bedroom', area: ['bedroom'], floor: 'wood',
          poly: [[3.03, 0.76], [6.21, 0.76], [6.21, 0.38], [7.83, 0.38], [7.83, 3.52], [4.97, 3.52], [4.97, 4.34], [3.03, 4.34]],
          furniture: [
            {t: 'bed', x: 6.75, z: 1.95, w: 2.05, d: 1.6, back: 'e'},
            {t: 'side', x: 7.6, z: 0.9, w: 0.4, d: 0.42}, {t: 'side', x: 7.6, z: 3.0, w: 0.4, d: 0.42},
            {t: 'rug', x: 5.3, z: 1.95, w: 1.4, d: 2.0},
            {t: 'wardrobe', x: 3.33, z: 2.5, w: 0.6, d: 2.6},
          ]},
        {id: 'loftlanding', name: 'Landing', area: [], floor: 'carpet',
          poly: [[5.03, 3.61], [6.02, 3.61], [6.02, 5.33], [5.03, 5.33]]},
        {id: 'bath2', name: 'Loft bathroom', area: ['loft_bathroom'], floor: 'tile',
          poly: [[6.08, 3.61], [7.83, 3.61], [7.83, 5.33], [6.08, 5.33]],
          furniture: [
            {t: 'shower', x: 7.35, z: 4.85, w: 0.9, d: 0.9},
            {t: 'toilet', x: 6.4, z: 5.0, w: 0.4, d: 0.6},
            {t: 'basin', x: 7.5, z: 3.85, w: 0.5, d: 0.42},
          ]},
      ],
      stairs: [{x1: 4.11, z1: 4.47, x2: 5.03, z2: 5.33, run: 'x'}],
      doors: [[5.15, 3.57, 5.95, 3.57], [6.15, 3.57, 6.85, 3.57], [5.03, 4.45, 5.03, 5.3]],
      windows: [[7.83, 1.05, 7.83, 2.65]],
      // The roof slopes down at the front: below 1.5 m headroom from here.
      eaves: {x: 3.7},
    },
  ],
  // Where things outside the walls sit (Ring cameras, the floodlight).
  outside: {front: [-0.45, 4.7], garden: [9.2, 2.6]},
  // Starting spots for the devices Ross already has; anything else lands in
  // its room and can be dragged into place.
  defaults: {
    'camera.front_door_live_view': ['ground', -0.45, 4.72],
    'camera.garden_live_view': ['ground', 9.3, 1.9],
    'light.garden_light': ['ground', 9.3, 3.1],
    'camera.living_room_live_view': ['ground', 3.9, 3.2],
    'camera.dining_room_live_view': ['ground', 7.4, 0.95],
    'light.porch_porch_light': ['ground', 0.43, 4.4],
    'binary_sensor.porch_porch_motion_sensor_occupancy': ['ground', 0.43, 5.2],
    'fan.bedroom_purifier': ['loft', 4.0, 0.95],
  },
};
