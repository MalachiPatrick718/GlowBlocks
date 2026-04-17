export interface PopupColor {
  id: number;
  name: string;
  rgb: [number, number, number];
  hex: string;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const BASE_COLORS: Array<[number, string, number, number, number]> = [
  [1, 'Soft Red', 180, 20, 20], [2, 'Crimson', 160, 20, 30], [3, 'Neon Red', 255, 40, 40], [4, 'Deep Orange', 180, 80, 10], [5, 'Warm Glow', 255, 150, 60],
  [6, 'Soft Yellow', 200, 200, 40], [7, 'Pale Yellow', 180, 180, 100], [8, 'Honey', 200, 160, 60], [9, 'Deep Green', 20, 120, 20], [10, 'Mint', 120, 220, 180],
  [11, 'Moss', 80, 120, 60], [12, 'Soft Lime', 140, 220, 80], [13, 'Navy', 10, 20, 80], [14, 'Neon Blue', 60, 140, 255], [15, 'Aqua Blue', 0, 180, 200],
  [16, 'Cyan Blue', 0, 160, 200], [17, 'Bright Sky', 120, 200, 255], [18, 'Violet', 160, 100, 255], [19, 'Royal Purple', 100, 0, 180], [20, 'Dark Violet', 90, 0, 140],
  [21, 'Classic Red', 200, 30, 30], [22, 'Warm Red', 200, 50, 30], [23, 'Faded Red', 120, 40, 40], [24, 'Peach', 240, 160, 100], [25, 'Coral', 240, 120, 90],
  [26, 'Warm Yellow', 220, 200, 60], [27, 'Lemon', 220, 220, 60], [28, 'Cream Yellow', 255, 240, 180], [29, 'Neon Green', 80, 255, 80], [30, 'Olive', 120, 140, 60],
  [31, 'Bright Green', 60, 220, 60], [32, 'Soft Blue', 40, 80, 180], [33, 'Sky Blue', 100, 160, 240], [34, 'Electric Blue', 0, 120, 255], [35, 'Steel Blue', 80, 120, 160],
  [36, 'Frost Blue', 150, 220, 255], [37, 'Soft Purple', 120, 60, 160], [38, 'Lavender', 200, 160, 255], [39, 'Magenta Purple', 200, 60, 200], [40, 'Orchid', 200, 120, 200],
  [41, 'Deep Red', 140, 10, 10], [42, 'Rose Red', 180, 60, 70], [43, 'Soft Orange', 200, 100, 20], [44, 'Burnt Orange', 160, 70, 20], [45, 'Sunset Orange', 255, 110, 50],
  [46, 'Golden', 255, 200, 80], [47, 'Neon Yellow', 255, 255, 80], [48, 'Soft Green', 40, 160, 40], [49, 'Lime', 120, 200, 60], [50, 'Pastel Green', 150, 200, 150],
  [51, 'Jade', 0, 160, 120], [52, 'Classic Blue', 50, 100, 200], [53, 'Ice Blue', 140, 200, 255], [54, 'Ocean', 0, 100, 180], [55, 'Powder Blue', 180, 220, 255],
  [56, 'Muted Blue', 80, 100, 140], [57, 'Classic Purple', 140, 80, 200], [58, 'Neon Purple', 180, 80, 255], [59, 'Light Lavender', 220, 200, 255], [60, 'Amethyst', 160, 120, 200],
  [61, 'Cherry Red', 220, 40, 40], [62, 'Blood Red', 120, 0, 0], [63, 'Classic Orange', 220, 120, 30], [64, 'Amber', 200, 140, 40], [65, 'Light Orange', 200, 130, 80],
  [66, 'Amber Yellow', 200, 180, 50], [67, 'Muted Yellow', 150, 150, 80], [68, 'Classic Green', 50, 180, 50], [69, 'Forest', 30, 100, 40], [70, 'Emerald', 0, 180, 100],
  [71, 'Sea Green', 60, 180, 120], [72, 'Deep Blue', 20, 40, 140], [73, 'Baby Blue', 120, 180, 240], [74, 'Teal Blue', 0, 140, 160], [75, 'Midnight Blue', 10, 10, 60],
  [76, 'Deep Ocean', 0, 80, 120], [77, 'Deep Purple', 80, 20, 120], [78, 'Plum', 120, 40, 120], [79, 'Pastel Purple', 180, 140, 220], [80, 'Purple Glow', 140, 60, 180],
  [81, 'Soft Pink', 255, 120, 160], [82, 'Baby Pink', 255, 180, 200], [83, 'Pastel Pink', 255, 200, 220], [84, 'Cool White', 180, 200, 255], [85, 'Golden Glow', 255, 200, 100],
  [86, 'Sunset Pink', 255, 110, 140], [87, 'Soft Sunset', 240, 130, 100], [88, 'Warm Peach', 255, 170, 140], [89, 'Warm Blush', 240, 140, 120], [90, 'Apricot', 255, 170, 100],
  [91, 'Soft Cyan', 0, 160, 180], [92, 'Teal Glow', 0, 140, 120], [93, 'Frost Cyan', 140, 230, 240], [94, 'Muted Cyan', 60, 140, 140], [95, 'Ocean Mist', 100, 180, 180],
  [96, 'Deep Crimson', 120, 10, 20], [97, 'Deep Orange', 150, 70, 20], [98, 'Forest Green', 20, 80, 40], [99, 'Midnight Purple', 40, 0, 80], [100, 'Dark Rose', 140, 40, 80],
  [101, 'Classic Pink', 255, 100, 150], [102, 'Neon Pink', 255, 80, 140], [103, 'Deep Pink', 200, 40, 100], [104, 'Neutral White', 200, 200, 200], [105, 'Ice Glow', 180, 220, 255],
  [106, 'Warm Coral', 255, 120, 100], [107, 'Golden Sunset', 255, 170, 80], [108, 'Burnt Sunset', 220, 100, 60], [109, 'Soft Amber', 220, 160, 100], [110, 'Dusty Sunset', 200, 120, 100],
  [111, 'Aqua Glow', 0, 180, 190], [112, 'Deep Teal', 0, 110, 100], [113, 'Pale Aqua', 120, 200, 200], [114, 'Soft Teal', 80, 160, 140], [115, 'Lagoon', 0, 150, 120],
  [116, 'Wine Red', 100, 20, 30], [117, 'Burnt Amber', 160, 100, 50], [118, 'Deep Moss', 60, 100, 60], [119, 'Dark Violet', 60, 0, 100], [120, 'Muted Burgundy', 120, 50, 70],
  [121, 'Hot Pink', 255, 60, 120], [122, 'Dusty Pink', 200, 120, 140], [123, 'Soft White', 180, 180, 180], [124, 'Dim White', 120, 120, 120], [125, 'Warm Amber', 255, 160, 80],
  [126, 'Sunset Gold', 255, 180, 90], [127, 'Rose Gold', 255, 150, 120], [128, 'Dusk Orange', 200, 120, 80], [129, 'Golden Peach', 255, 180, 120], [130, 'Copper Glow', 200, 110, 80],
  [131, 'Ocean Cyan', 0, 140, 160], [132, 'Mint Cyan', 80, 200, 180], [133, 'Blue Teal', 0, 120, 150], [134, 'Neon Aqua', 0, 220, 200], [135, 'Clear Aqua', 120, 200, 220],
  [136, 'Dark Coral', 180, 60, 50], [137, 'Deep Gold', 180, 140, 60], [138, 'Deep Blue', 10, 30, 100], [139, 'Plum Night', 80, 20, 80], [140, 'Deep Navy', 10, 10, 50],
  [141, 'Rose Pink', 255, 140, 180], [142, 'Coral Pink', 255, 130, 130], [143, 'Warm White', 255, 180, 120], [144, 'Candle Glow', 255, 140, 60], [145, 'Soft Glow', 160, 140, 120],
  [146, 'Peach Glow', 255, 160, 120], [147, 'Blush Orange', 255, 140, 110], [148, 'Light Coral', 255, 150, 130], [149, 'Honey Glow', 255, 190, 110], [150, 'Warm Sand', 220, 180, 140],
  [151, 'Bright Aqua', 0, 200, 200], [152, 'Ice Aqua', 120, 220, 220], [153, 'Green Cyan', 0, 180, 140], [154, 'Pastel Cyan', 150, 220, 220], [155, 'Seafoam', 120, 200, 160],
  [156, 'Rust Red', 140, 60, 40], [157, 'Olive Gold', 140, 120, 60], [158, 'Indigo', 30, 20, 120], [159, 'Deep Magenta', 120, 20, 100], [160, 'Storm Blue', 60, 80, 100],
  [161, 'Neon Peach', 255, 140, 80], [162, 'Neon Mint', 120, 255, 180], [163, 'Neon Indigo', 100, 80, 255], [164, 'Neon Rose', 255, 120, 160], [165, 'Bright Violet', 200, 100, 255],
  [166, 'Pastel Coral', 255, 190, 170], [167, 'Pastel Mint', 180, 255, 220], [168, 'Pastel Purple', 220, 200, 255], [169, 'Soft Lavender', 220, 200, 240], [170, 'Cream Glow', 255, 240, 200],
  [171, 'Neon Orange', 255, 120, 20], [172, 'Neon Green', 100, 255, 100], [173, 'Neon Blue', 80, 140, 255], [174, 'Neon Pink', 255, 100, 180], [175, 'Electric Lime', 180, 255, 60],
  [176, 'Pastel Peach', 255, 200, 180], [177, 'Pastel Green', 180, 240, 180], [178, 'Pastel Indigo', 200, 200, 255], [179, 'Powder Pink', 255, 200, 220], [180, 'Ice Lavender', 230, 220, 255],
  [181, 'Neon Yellow', 255, 255, 100], [182, 'Neon Cyan', 0, 255, 220], [183, 'Neon Purple', 180, 80, 255], [184, 'Bright Coral', 255, 130, 100], [185, 'Bright Sky', 120, 220, 255],
  [186, 'Pastel Yellow', 255, 240, 180], [187, 'Pastel Cyan', 200, 255, 255], [188, 'Pastel Pink', 255, 210, 230], [189, 'Pale Lilac', 230, 210, 255], [190, 'Soft Beige', 220, 200, 160],
  [191, 'Neon Lime', 180, 255, 80], [192, 'Neon Sky', 100, 200, 255], [193, 'Neon Magenta', 255, 80, 200], [194, 'Electric Aqua', 0, 220, 200], [195, 'Bright Lavender', 200, 180, 255],
  [196, 'Pastel Lime', 200, 255, 180], [197, 'Pastel Blue', 200, 220, 255], [198, 'Soft Rose', 255, 180, 200], [199, 'Baby Blue Glow', 200, 230, 255], [200, 'Warm Ivory', 255, 230, 200],
];

export const POPUP_COLOR_CATALOG: PopupColor[] = BASE_COLORS.map(([id, name, r, g, b]) => ({
  id,
  name,
  rgb: [r, g, b],
  hex: rgbToHex(r, g, b),
}));

export const POPUP_COLOR_MAP = new Map<number, PopupColor>(
  POPUP_COLOR_CATALOG.map((entry) => [entry.id, entry])
);
