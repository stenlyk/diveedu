/**
 * Diagramy pro otázky typu „označ na diagramu“. Jen data (bez Reactu), aby je mohl číst i validátor obsahu.
 * Souřadnice jsou ve viewBoxu 320 × 190.
 */
export interface DiagramDef {
  title: string;
  hotspots: { id: string; x: number; y: number }[];
}

export const DIAGRAMS: Readonly<Record<string, DiagramDef>> = {
  'rozcesti-t': {
    title: 'Rozcestí T: tři šňůry, na každé trvalá šipka, na jedné kulatá osobní značka. Přicházíš zdola.',
    hotspots: [{ id: 'a', x: 44, y: 70 }, { id: 'b', x: 276, y: 70 }, { id: 'c', x: 160, y: 162 }],
  },
  skok: {
    title: 'Hlavní šňůra se šipkou a boční šňůra, mezi nimi mezera bez šňůry.',
    hotspots: [{ id: 'a', x: 56, y: 138 }, { id: 'b', x: 181, y: 103 }, { id: 'c', x: 200, y: 72 }, { id: 'd', x: 276, y: 40 }],
  },
  uvazani: {
    title: 'Řez vchodem jeskyně: hladina, otevřená voda, vchod pod skalním stropem a chodba.',
    hotspots: [{ id: 'a', x: 44, y: 26 }, { id: 'b', x: 76, y: 132 }, { id: 'c', x: 158, y: 134 }, { id: 'd', x: 272, y: 146 }],
  },
  znacky: {
    title: 'Tři značky na šňůře: trojúhelníková, kulatá a obdélníková.',
    hotspots: [{ id: 'a', x: 70, y: 80 }, { id: 'b', x: 160, y: 80 }, { id: 'c', x: 250, y: 80 }],
  },
};
