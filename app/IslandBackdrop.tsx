// Animated background: the real island of Madagascar at sunset. Baobabs, hopping
// ring-tailed lemurs, a color-shifting chameleon and fireflies, in the app's riso colors.
// Purely decorative: fixed behind the page, ignored by screen readers and clicks.

const BAOBABS = [
  { x: 150, h: 150, w: 1 },
  { x: 330, h: 210, w: 1.25 },
  { x: 520, h: 120, w: 0.85 },
  { x: 760, h: 190, w: 1.15 },
  { x: 1010, h: 160, w: 1 },
  { x: 1150, h: 110, w: 0.8 },
];
const GROUND = 330;

function Baobab({ x, h, w }: { x: number; h: number; w: number }) {
  const top = GROUND - h;
  const b = 18 * w; // trunk half-width at the base
  const t = 9 * w;  // half-width at the top
  return (
    <g className="baobab">
      <path
        d={`M${x - b} ${GROUND} C${x - b - 8} ${GROUND - h * 0.45}, ${x - t - 2} ${top + h * 0.15}, ${x - t} ${top}
            L${x + t} ${top} C${x + t + 2} ${top + h * 0.15}, ${x + b + 8} ${GROUND - h * 0.45}, ${x + b} ${GROUND} Z`}
      />
      {/* stubby branches with little leaf clumps, the baobab's "upside-down roots" look */}
      {[-1.6, -0.7, 0.3, 1.3].map((k, i) => {
        const ex = x + k * 26 * w;
        const ey = top - (i % 2 ? 26 : 16) * w;
        return (
          <g key={i}>
            <path d={`M${x + k * 4} ${top + 2} Q${x + k * 14 * w} ${top - 6}, ${ex} ${ey}`} className="branch" style={{ strokeWidth: 5 * w }} />
            <ellipse cx={ex} cy={ey - 4 * w} rx={13 * w} ry={7 * w} />
          </g>
        );
      })}
    </g>
  );
}

function Lemur() {
  // Drawn facing right with feet at (0,0).
  return (
    <g className="lemur-body">
      <path className="tail-base" d="M-14 -22 C-40 -30,-48 -70,-28 -88 C-16 -98,-4 -90,-10 -80" />
      <path className="tail-rings" d="M-14 -22 C-40 -30,-48 -70,-28 -88 C-16 -98,-4 -90,-10 -80" />
      <path className="leg" d="M-10 -14 L-14 0 M8 -14 L12 0" />
      <ellipse className="fur" cx="0" cy="-24" rx="19" ry="13" />
      <circle className="fur" cx="13" cy="-46" r="4" />
      <circle className="fur" cx="19" cy="-37" r="11" />
      <ellipse className="mask" cx="22" cy="-35" rx="7.5" ry="6.5" />
      <path className="snout" d="M26 -38 L36 -34 L26 -30 Z" />
      <circle className="eye" cx="23" cy="-38" r="3.4" />
      <circle className="pupil" cx="24" cy="-38" r="1.4" />
    </g>
  );
}

function Chameleon() {
  // Sits on a branch reaching in from the left edge.
  return (
    <g className="chameleon-scene">
      <path className="branch" d="M-10 262 C70 252,150 262,250 248" style={{ strokeWidth: 9 }} />
      <ellipse cx="236" cy="246" rx="14" ry="6" className="leaf" />
      <g className="chameleon" transform="translate(130 255)">
        <path className="tongue" d="M30 -16 L95 -26" />
        <path className="cham-tail" d="M-26 -8 C-44 0,-44 20,-30 22 C-20 24,-16 13,-24 11" />
        <path className="cham-body" d="M-28 -10 C-20 -30,18 -32,28 -16 C32 -10,26 -4,18 -4 L-22 -4 C-28 -4,-30 -7,-28 -10 Z" />
        <path className="cham-body" d="M14 -26 L24 -34 L30 -18 Z" />
        <path className="cham-leg" d="M-14 -5 L-18 6 M10 -5 L14 6" />
        <circle className="cham-eye" cx="20" cy="-19" r="5" />
        <circle className="pupil" cx="22" cy="-19" r="1.8" />
      </g>
    </g>
  );
}

export default function IslandBackdrop() {
  return (
    <div className="island" aria-hidden="true">
      <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
        <circle className="sun sun-a" cx="880" cy="175" r="92" />
        <circle className="sun sun-b" cx="892" cy="184" r="92" />

        <g className="cloud cloud-1"><ellipse cx="240" cy="90" rx="70" ry="16" /><ellipse cx="290" cy="76" rx="40" ry="14" /></g>
        <g className="cloud cloud-2"><ellipse cx="700" cy="60" rx="90" ry="15" /><ellipse cx="650" cy="48" rx="44" ry="13" /></g>
        <g className="cloud cloud-3"><ellipse cx="1080" cy="110" rx="60" ry="12" /></g>

        <path className="hill" d="M0 330 Q300 296 600 324 T1200 312 V400 H0 Z" />
        {BAOBABS.map((b) => <Baobab key={b.x} {...b} />)}
        <path className="ground" d="M0 336 Q400 322 800 338 T1200 330 V400 H0 Z" />

        {/* three lemurs crossing the island at different speeds */}
        {[0, 1, 2].map((i) => (
          <g key={i} className={`lemur-run run-${i}`}>
            <g transform={`translate(0 ${GROUND + 6 + i * 10}) scale(${1 - i * 0.18})`}>
              <g className="lemur-hop"><Lemur /></g>
            </g>
          </g>
        ))}

        <Chameleon />

        {[
          [210, 210], [260, 190], [420, 240], [610, 200], [690, 250], [930, 230], [1100, 200], [1150, 260],
        ].map(([cx, cy], i) => (
          <circle key={i} className="firefly" cx={cx} cy={cy} r="3" style={{ animationDelay: `${(i * 0.7) % 3}s` }} />
        ))}
      </svg>
    </div>
  );
}
