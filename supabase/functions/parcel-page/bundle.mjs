import {mountMap} from './map.mjs';
import {mountPage} from './page.mjs';

// Both functions are self-contained browser entry points using the page's dependencies.
export function bundle() {
  return '(' + mountMap.toString() + ')();\n(' + mountPage.toString() + ')();';
}
