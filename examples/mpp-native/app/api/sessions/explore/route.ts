import { mppx } from '@/app/lib/mppx';

// Deterministic tile generation from coordinates.
// Same (x, y) always produces the same tile — no database needed.
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x1b873593);
  return (h ^ (h >>> 13)) >>> 0;
}

const terrains = ['ocean', 'beach', 'plains', 'forest', 'hills', 'mountains', 'desert', 'tundra'] as const;
const features = [null, null, null, 'ruins', 'village', 'cave', 'oasis', 'watchtower', 'shipwreck', null] as const;
const descriptors: Record<string, string[]> = {
  ocean: ['Deep blue waters stretch to the horizon.', 'Waves lap against nothing in particular.', 'A school of silver fish darts beneath the surface.'],
  beach: ['White sand meets turquoise water.', 'Shells litter the shoreline.', 'Footprints vanish where the tide rolls in.'],
  plains: ['Tall grass sways in the wind.', 'A gentle breeze carries the scent of wildflowers.', 'The land stretches flat in every direction.'],
  forest: ['Ancient trees form a dense canopy overhead.', 'Shafts of light pierce through the leaves.', 'The underbrush is thick with ferns.'],
  hills: ['Rolling green hills undulate toward the horizon.', 'Wildflowers dot the slopes.', 'A stream cuts through the valley between ridges.'],
  mountains: ['Jagged peaks pierce the clouds above.', 'The air is thin and cold.', 'Snow clings to the upper ridges.'],
  desert: ['Sand dunes ripple under a blazing sun.', 'Heat shimmers distort the distant landscape.', 'A lone cactus stands defiant.'],
  tundra: ['Frozen earth stretches endlessly.', 'Lichen-covered rocks break the white expanse.', 'A biting wind howls across the permafrost.'],
};

function generateTile(x: number, y: number) {
  const h = hash(x, y);
  const terrain = terrains[h % terrains.length];
  const elevation = ((h >>> 3) % 200) * (terrain === 'ocean' ? -1 : 1);
  const feature = features[(h >>> 8) % features.length];
  const desc = descriptors[terrain][(h >>> 12) % descriptors[terrain].length];

  return {
    x,
    y,
    terrain,
    elevation,
    ...(feature ? { feature } : {}),
    description: feature ? `${desc} ${feature.charAt(0).toUpperCase() + feature.slice(1)} nearby.` : desc,
  };
}

// Each tile reveal costs $0.001. An exploring agent might request 50-100 tiles
// in a single session — with charges that would be 50-100 on-chain transactions
// (~500ms each). With sessions, it's one deposit + instant off-chain vouchers.
export const GET = mppx.session({ amount: '0.001', unitType: 'tile' })(
  async (request: Request) => {
    const url = new URL(request.url);
    const x = parseInt(url.searchParams.get('x') ?? '0', 10);
    const y = parseInt(url.searchParams.get('y') ?? '0', 10);

    if (isNaN(x) || isNaN(y)) {
      return Response.json({ error: 'x and y must be integers' }, { status: 400 });
    }

    return Response.json(generateTile(x, y));
  },
);
