/**
 * Animované výklady: krátké scény kreslené v aplikaci a řízené namluveným textem.
 * Tady jsou jen data (bez Reactu), aby je mohl číst generátor zvuku i validátor obsahu.
 * Každá věta výkladu je jeden krok scény; čísla ve větách hlídá test proti funkcím z calc.
 */
export interface AnimationDef {
  id: string;
  title: string;
  moduleId: string;
  lessonId: string;
  /** Věty výkladu. Čtou se nahlas a zároveň slouží jako titulky. */
  cues: string[];
}

export const ANIMATIONS: readonly AnimationDef[] = [
  {
    id: 'tlak-a-objem',
    title: 'Tlak a objem plynu',
    moduleId: 'zaklady',
    lessonId: 'boyle-objem',
    cues: [
      'Na hladině tlačí na balonek jeden bar. Má objem deset litrů.',
      'V deseti metrech je tlak dvojnásobný. Balonek se zmenší na polovinu, na pět litrů.',
      'Ve třiceti metrech jsou to čtyři bary a dva a půl litru.',
      'Všimni si, kde se objem mění nejvíc. Prvních deset metrů ho zmenší o polovinu. Dalších dvacet už jen o čtvrtinu původního objemu.',
      'Při výstupu to platí obráceně. Plyn v plicích se mezi deseti metry a hladinou roztáhne na dvojnásobek.',
      'Proto se při výstupu nikdy nezadržuje dech. A proto je posledních deset metrů nejnebezpečnějších.',
    ],
  },
  {
    id: 'ppo2-a-mod',
    title: 'Parciální tlak kyslíku a maximální operační hloubka',
    moduleId: 'nitrox',
    lessonId: 'ppo2-a-mod',
    cues: [
      'Vzduch obsahuje dvacet jedna procent kyslíku. Na hladině je jeho parciální tlak nula celá dvacet jedna baru.',
      'S hloubkou roste celkový tlak a s ním i tlak každé složky. Ve čtyřiceti metrech je to pět barů a parciální tlak kyslíku jedna celá nula pět.',
      'Nitrox třicet dva má kyslíku víc. Ve stejné hloubce dává jedna celá šest baru.',
      'To je hranice. Nad jedna celá čtyři baru při práci a jedna celá šest v klidu hrozí kyslíkové křeče, bez varování.',
      'Hloubka, ve které směs dosáhne limitu, je její maximální operační hloubka. Pro nitrox třicet dva a limit jedna celá čtyři je to třiatřicet metrů.',
      'Dekompresní plyny se počítají s limitem jedna celá šest. Padesátka tak končí ve dvaadvaceti metrech, čistý kyslík v šesti.',
    ],
  },
  {
    id: 'syceni-a-dekomprese',
    title: 'Sycení tkání a dekomprese',
    moduleId: 'deko',
    lessonId: 'od-haldana-k-buhlmannovi',
    cues: [
      'Tkáně si představ jako nádoby. Některé se plní rychle, jiné pomalu.',
      'Při sestupu stoupne tlak dusíku, který dýcháš. Rychlé tkáně se nasytí za pár minut, pomalé sotva začnou.',
      'Čím déle na dně, tím víc se plní i ty pomalé.',
      'Při výstupu okolní tlak klesne. V tkáních je teď víc dusíku než kolem nich. Tomu se říká přesycení.',
      'Malé přesycení tělo snese a plyn odchází dechem. Příliš velké znamená bubliny.',
      'Dekompresní zastávka drží přesycení pod hranicí a dává tkáním čas. Nejdřív se vyprázdní rychlé. Pomalé rozhodují o délce posledních zastávek.',
    ],
  },
  {
    id: 'tretiny-v-jeskyni',
    title: 'Pravidlo třetin v jeskyni',
    moduleId: 'cavern',
    lessonId: 'plyn-v-jeskyni',
    cues: [
      'Dva potápěči vplouvají do jeskyně. Každý má dvě stě deset barů.',
      'Třetinu plynu smí použít na cestu dovnitř. Sedmdesát barů.',
      'Na sto čtyřiceti barech se otáčejí. Tady cesta dovnitř končí, i kdyby cíl byl za rohem.',
      'V nejvzdálenějším bodě přijde jeden z nich o všechen plyn.',
      'Ven teď dýchají oba z jedné zásoby. Spotřeba je dvojnásobná.',
      'Cesta ven stojí sto čtyřicet barů. Přesně tolik, kolik zbývalo.',
      'Třetiny nejsou opatrnost navíc. Je to nejmenší rezerva, se kterou to vyjde. A jen když cesta ven netrvá déle než cesta dovnitř.',
    ],
  },
  {
    id: 'rozcesti-a-znacky',
    title: 'Rozcestí, šipky a vlastní značka',
    moduleId: 'fullcave',
    lessonId: 'skoky-mezery-rozcesti',
    cues: [
      'Jeskyně se dvěma vchody. Hlavní šňůra vede od tvého vchodu k rozcestí.',
      'Trvalé šipky na šňůře ukazují k nejbližšímu východu. Ne k tomu tvému.',
      'Na rozcestí proto dáš na šňůru, po které jsi přišel, vlastní značku.',
      'Plaveš dál. Při otočce se zvedne sediment a nevidíš nic.',
      'Vracíš se po hmatu. Na rozcestí nahmatáš dvě šňůry a na obou šipku, která ukazuje ven.',
      'Jen na jedné je tvoje značka. Ta vede k tvému vchodu, k tvému týmu a k tvému plynu.',
      'Bez ní by sis vybíral naslepo.',
    ],
  },
  {
    id: 'gradient-faktory',
    title: 'Gradient factors: kolik přesycení si dovolíš',
    moduleId: 'deko',
    lessonId: 'gradient-factors',
    cues: [
      'M-hodnota je nejvyšší tlak plynu, který model v tkáni připouští. Čím hlouběji, tím je vyšší.',
      'Mezi okolním tlakem a M-hodnotou je pásmo přesycení. Gradient faktor říká, kolik procent z něj smíš využít.',
      'První číslo, dolní gradient faktor, platí pro první a nejhlubší zastávku. Třicet procent znamená zastavit brzy a hluboko.',
      'Druhé číslo, horní gradient faktor, platí pro vynoření. Osmdesát pět procent nechává patnáct procent pásma jako rezervu.',
      'Mezi nimi vede přímka. Cestou nahoru smíš z pásma využívat postupně víc.',
      'Nižší čísla znamenají delší dekompresi a menší přesycení. Nejsou zárukou. Jen posouvají hranici dál od M-hodnoty.',
    ],
  },
  {
    id: 'hustota-a-helium',
    title: 'Hustota plynu a proč helium',
    moduleId: 'trimix',
    lessonId: 'hustota-smesi',
    cues: [
      'Vzduch má na hladině hustotu asi jedna celá tři gramu na litr.',
      'S hloubkou roste hustota stejně jako tlak. Ve čtyřiceti metrech je to skoro šest a půl gramu na litr.',
      'Hustý plyn se hůř dýchá. Tělo se nestíhá zbavit oxidu uhličitého a ten zhoršuje narkózu i riziko křečí.',
      'Doporučená mez je pět celých dva gramu na litr, horní mez šest celých dva.',
      'Helium je sedmkrát lehčí než dusík. Trimix osmnáct čtyřicet pět má v šedesáti metrech hustotu pět celých šest.',
      'Vzduch by ve stejné hloubce měl devět gramů na litr. Proto se do hloubky přidává helium, nejen kvůli narkóze.',
    ],
  },
  {
    id: 'skok-civkou',
    title: 'Skok: přemostění mezery cívkou',
    moduleId: 'fullcave',
    lessonId: 'skoky-mezery-rozcesti',
    cues: [
      'Hlavní šňůra vede chodbou. Boční chodba má vlastní šňůru, která začíná o pár metrů dál.',
      'Mezi nimi je mezera. Teď ji vidíš celou. Při návratu v nulové viditelnosti bys druhou šňůru hledal rukou.',
      'Nejdřív si na hlavní šňůře označíš cestu ven.',
      'Potom připojíš cívku k hlavní šňůře a odvineš ji k boční.',
      'Teď vede od tebe souvislá šňůra až do otevřené vody. Mezera zmizela.',
      'Cestou ven sebere cívku ten, kdo plave poslední. Až když jsou všichni zpátky na hlavní šňůře.',
    ],
  },
];

export const animationsById: ReadonlyMap<string, AnimationDef> = new Map(ANIMATIONS.map((animation) => [animation.id, animation]));
