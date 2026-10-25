import { FontDisplay, loadAsync } from 'expo-font';
import regular from 'expo-symbols/androidWeights/regular';

// The web draws icons with the Material Symbols font (expo-symbols), whose full file is 970 KB. This loads a subset of
// only the icons Glyph.tsx and Icon.tsx use (7 KB, scripts/subset-icons.sh) under the same family name, with swap.
// expo-font loads a family once, so expo-symbols never fetches the full file. A new icon: rerun the script.
void loadAsync({
  [regular.name]: { uri: require('@/assets/fonts/MaterialSymbols_400Regular.subset.ttf'), display: FontDisplay.SWAP },
}).catch(() => {});
