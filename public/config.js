// Tunables for the 3D view. Distances are in the same units as the
// ESPresense-companion floorplan (metres).
export const CONFIG = {
  // Room outline colour per floor, cycled if there are more floors than colours
  floorColors: [0x03a062, 0x41a003],
  // Skip rooms with no name (often used for stairwells or outlines in the companion config)
  hideUnnamedRooms: true,

  // Device sphere colour, assigned in the order devices first appear
  trackerColors: [0xff2c04, 0x2c2cff, 0x663399, 0x41ff04],
  trackerRadius: 0.2,
  pulse: { min: 1, max: 1.25, periodSeconds: 1.7 },

  bloom: { strength: 1, radius: 0.25, threshold: 0 },
  exposure: 1,

  camera: {
    fov: 45,
    elevationDegrees: 30, // angle above the horizon for the starting view
    distance: 2, // starting distance, as a multiple of the house's bounding radius
    minDistance: 0.5,
    maxDistance: 4,
  },
  autoRotateSpeed: 1, // 1 = one turn per minute
};
