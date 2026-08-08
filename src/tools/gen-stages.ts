// Generate a fighting-stage BACKGROUND (opaque, no chroma-key) with gpt-image-2,
// downscale to a packed RGBA at 3:2, and store under assets/stages/<id>.json.
//   tsx src/tools/gen-stages.ts dojo
import OpenAI from 'openai';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../assets/stages');
const MODEL = process.env.SF_IMG_MODEL ?? 'gpt-image-2';
const QUALITY = (process.env.SF_IMG_QUALITY ?? 'high') as 'low' | 'medium' | 'high';
const STORE_W = 768, STORE_H = 512; // packed store size (3:2)

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

interface Stage { id: string; prompt: string; }
const STAGES: Stage[] = [
  {
    id: 'dojo',
    prompt: `A 2D arcade fighting-game STAGE BACKGROUND, side view, wide horizontal composition, an EMPTY arena with NO people and NO fighters.
SCENE: a traditional Japanese temple and dojo courtyard at golden-hour sunset. On the left and right edges: wooden dojo buildings with curved tiled roofs and glowing red paper lanterns hanging under the eaves; a large blossoming cherry-blossom tree with pink flowers on one side. A flat stone-paved courtyard floor runs straight and level across the very BOTTOM of the image. In the far background: rolling green hills and a large snow-capped Mount Fuji, under a warm orange-and-pink gradient sky with a few soft clouds and a low sun.
STYLE: bright, saturated, colorful, bold clean outlines, flat cel-shading, classic 1990s arcade fighter stage art; strong depth with clear foreground, midground and background layers; detailed but readable.
COMPOSITION: horizontal side-scrolling stage; the flat fighting floor is a clear horizontal plane across the bottom ~18% of the image; keep the central area open (where the fighters will stand); absolutely NO text, NO UI, NO logos, NO watermark, NO characters, NO people, NO animals.`,
  },
  {
    id: 'market',
    prompt: `A 2D arcade fighting-game STAGE BACKGROUND, side view, wide horizontal composition, an EMPTY arena with NO people and NO fighters.
SCENE: a bustling Hong Kong / Chinatown night-market street. Rows of glowing neon signs, red and gold paper lanterns strung overhead, colorful market stalls with hanging food and fruit, cloth banners and awnings, tall old apartment buildings with laundry lines and window air-conditioners fading into a deep blue starry night sky. A wet cobblestone street reflects the neon glow. A flat cobblestone street runs straight and level across the very BOTTOM of the image.
STYLE: bright, saturated, glowing neon colors, bold clean outlines, flat cel-shading, classic 1990s arcade fighter stage art; strong depth with foreground, midground and background layers; detailed but readable.
COMPOSITION: horizontal side-scrolling stage; the flat fighting floor (street) is a clear horizontal plane across the bottom ~18% of the image; keep the central area open (where the fighters will stand); NO readable text, NO UI, NO logos, NO watermark, NO characters, NO people, NO animals.`,
  },
  {
    id: 'jungle',
    prompt: `A 2D arcade fighting-game STAGE BACKGROUND, side view, wide horizontal composition, an EMPTY arena with NO people and NO fighters.
SCENE: a lush tropical jungle clearing in front of ancient overgrown stone temple ruins. Crumbling carved stone blocks and pillars wrapped in green vines and moss, a large cascading waterfall pouring into a misty pool in the background, giant exotic leaves and ferns, bright tropical flowers, vivid green foliage, warm sunbeams breaking through the canopy, a bright daytime sky. A flat mossy stone platform runs straight and level across the very BOTTOM of the image.
STYLE: bright, saturated, lush greens, bold clean outlines, flat cel-shading, classic 1990s arcade fighter stage art; strong depth with foreground, midground and background layers; detailed but readable.
COMPOSITION: horizontal side-scrolling stage; the flat fighting floor is a clear horizontal plane across the bottom ~18% of the image; keep the central area open (where the fighters will stand); absolutely NO text, NO UI, NO logos, NO watermark, NO characters, NO people, NO animals.`,
  },
  {
    id: 'airbase',
    prompt: `A 2D 1990s arcade fighting-game STAGE BACKGROUND, wide fixed side view, with NO people and NO fighters.
SCENE: a remote mountain airbase at dramatic sunrise. A parked silver interceptor and open hangar frame the left edge; another jet tail, stacked equipment crates, windsock, radar dish, beacons and fuel hoses frame the right. Runway lights recede toward snow-capped mountains beneath layered lavender and gold clouds. A broad riveted concrete runway spans the bottom 18 percent.
STYLE: vivid hand-painted pixel-art and cel shading, bold outlines, saturated color, rich foreground-midground-background depth, detailed and immersive but readable at small size.
COMPOSITION: keep the central fighting area open; straight level floor edge to edge; NO readable words, UI, logos, watermark, characters, people or animals.`,
  },
  {
    id: 'monsoon',
    prompt: `A 2D 1990s arcade fighting-game STAGE BACKGROUND, wide fixed side view, with NO people and NO fighters.
SCENE: an ornate Indian palace rooftop during a warm monsoon dusk. Carved sandstone arches frame both sides with turquoise-and-gold tilework, billowing silk canopies, strings of oil lamps, brass braziers, incense burners and rain chains. Beyond the open center are domed rooftops, a river and old city fading into purple rain, with sun rays and distant lightning. A broad wet patterned sandstone terrace spans the bottom 18 percent.
STYLE: vivid hand-painted pixel-art and cel shading, bold outlines, saturated color, rich foreground-midground-background depth, detailed and immersive but readable at small size.
COMPOSITION: keep the central fighting area open; straight level floor edge to edge; NO readable words, UI, logos, watermark, characters, people or animals.`,
  },
  {
    id: 'harbor',
    prompt: `A 2D 1990s arcade fighting-game STAGE BACKGROUND, wide fixed side view, with NO people and NO fighters.
SCENE: a stormy neon industrial harbor at night. Massive cargo cranes and container stacks frame the edges, with mooring ropes, bollards, a huge freighter, lighthouse, choppy water, distant refinery lights, rain curtains and lightning. Puddles reflect cyan, amber and magenta work lights. A broad wet steel loading platform spans the bottom 18 percent.
STYLE: vivid hand-painted pixel-art and cel shading, bold outlines, saturated color, rich foreground-midground-background depth, detailed and immersive but readable at small size.
COMPOSITION: keep the central fighting area open; straight level floor edge to edge; NO readable words, UI, logos, watermark, characters, people or animals.`,
  },
];

async function generate(prompt: string): Promise<Buffer> {
  if (!openai) throw new Error('OPENAI_API_KEY not set');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await openai.images.generate({ model: MODEL, prompt, size: '1536x1024', quality: QUALITY } as never);
      const b64 = (r.data?.[0] as { b64_json?: string })?.b64_json;
      if (b64) return Buffer.from(b64, 'base64');
    } catch (e) { console.error('  retry', (e as Error).message.slice(0, 100)); }
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  throw new Error('stage generation failed');
}

async function pack(png: Buffer): Promise<{ w: number; h: number; data: string }> {
  const { data, info } = await sharp(png).resize(STORE_W, STORE_H, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: Buffer.from(data).toString('base64') };
}

const arg = (process.argv[2] ?? 'dojo').toLowerCase();
mkdirSync(resolve(OUT, 'raw'), { recursive: true });
if (arg === 'repack') {
  for (const st of STAGES) {
    const raw = resolve(OUT, `raw/${st.id}.png`);
    if (!existsSync(raw)) continue;
    writeFileSync(resolve(OUT, `${st.id}.json`), JSON.stringify(await pack(readFileSync(raw))));
    console.log(`repacked ${st.id} -> ${resolve(OUT, `${st.id}.json`)}`);
  }
} else {
  const targets = arg === 'all' ? STAGES : STAGES.filter((s) => s.id === arg);
  if (targets.length === 0) { console.error(`unknown stage ${arg}; options: ${STAGES.map((s) => s.id).join(', ')}, repack`); process.exit(1); }
  if (!openai) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
  for (const st of targets) {
    console.log(`generating stage ${st.id}...`);
    const png = await generate(st.prompt);
    writeFileSync(resolve(OUT, `raw/${st.id}.png`), png);
    writeFileSync(resolve(OUT, `${st.id}.json`), JSON.stringify(await pack(png)));
    console.log(`  -> ${resolve(OUT, `${st.id}.json`)}`);
  }
}
console.log('done.');
