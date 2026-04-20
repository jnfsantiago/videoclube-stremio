const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs   = require("fs");
const path = require("path");

// ── Carregar catálogo ─────────────────────────────────────────────
const CATALOG_PATH = path.join(__dirname, "catalog.json");

function loadCatalog() {
    if (!fs.existsSync(CATALOG_PATH)) {
        console.error("❌  catalog.json não encontrado. Corre primeiro exportar_catalogo.py.");
        return [];
    }
    const data = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
    console.log(`✅  Catálogo carregado: ${data.length} filmes`);
    return data;
}

let FILMES = loadCatalog();

// Recarregar automaticamente se o catalog.json for actualizado
fs.watchFile(CATALOG_PATH, () => {
    console.log("🔄  catalog.json actualizado — a recarregar...");
    FILMES = loadCatalog();
});

// ── Géneros únicos para filtros ───────────────────────────────────
function getGeneros() {
    const generos = new Set();
    FILMES.forEach(f => { if (f.genre) generos.add(f.genre); });
    return Array.from(generos).sort();
}

// ── Manifest ──────────────────────────────────────────────────────
const manifest = {
    id:          "pt.videoclube.josesantiago",
    version:     "1.0.0",
    name:        "Videoclube José Santiago",
    description: "A minha colecção pessoal de filmes em VHS, DVD, Blu-ray e 4K",
    logo:        "https://i.imgur.com/placeholder.png",  // substitui por uma imagem tua
    resources:   ["catalog"],
    types:       ["movie"],
    idPrefixes:  ["tt"],
    catalogs: [
        {
            id:   "vjs_todos",
            type: "movie",
            name: "🎬 Toda a colecção",
            extra: [
                { name: "genre",  isRequired: false, options: [] },  // preenchido abaixo
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },
            ],
        },
        {
            id:   "vjs_vhs",
            type: "movie",
            name: "📼 VHS Portugal",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },
            ],
        },
        {
            id:   "vjs_dvd",
            type: "movie",
            name: "📀 DVD",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },
            ],
        },
        {
            id:   "vjs_br4k",
            type: "movie",
            name: "🔵 Blu-ray & 4K",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip",   isRequired: false },
            ],
        },
    ],
};

// Preencher géneros no catálogo principal
manifest.catalogs[0].extra[0].options = getGeneros();

// ── Builder ───────────────────────────────────────────────────────
const builder = new addonBuilder(manifest);

// ── Filtros por catálogo ──────────────────────────────────────────
const FORMATO_FILTER = {
    vjs_todos: null,               // sem filtro
    vjs_vhs:   ["VHS"],
    vjs_dvd:   ["DVD"],
    vjs_br4k:  ["Blu-ray", "4K UHD", "4K UHD + Blu-ray", "Blu-ray 3D"],
};

// ── Catalog handler ───────────────────────────────────────────────
builder.defineCatalogHandler(({ type, id, extra }) => {
    if (type !== "movie") return Promise.resolve({ metas: [] });

    const PAGE_SIZE = 100;
    const skip      = parseInt(extra.skip || 0);
    const search    = (extra.search || "").toLowerCase();
    const genre     = extra.genre || "";
    const formatos  = FORMATO_FILTER[id] || null;

    let filmes = FILMES;

    // Filtrar por formato
    if (formatos) {
        filmes = filmes.filter(f =>
            f.formatos && f.formatos.some(fmt => formatos.includes(fmt))
        );
    }

    // Filtrar por género
    if (genre) {
        filmes = filmes.filter(f => f.genre === genre);
    }

    // Pesquisa por título
    if (search) {
        filmes = filmes.filter(f =>
            (f.name    && f.name.toLowerCase().includes(search)) ||
            (f.name_pt && f.name_pt.toLowerCase().includes(search)) ||
            (f.director && f.director.toLowerCase().includes(search))
        );
    }

    const metas = filmes
        .slice(skip, skip + PAGE_SIZE)
        .map(f => filmeMeta(f));

    return Promise.resolve({ metas });
});



// ── Construir objecto meta ────────────────────────────────────────
// Para o catálogo: devolve apenas id e type para o Cinemeta
// tratar de ir buscar capas e metadados completos via IMDB ID
function filmeMeta(f) {
    const formatos = f.formatos ? f.formatos.join(" · ") : f.formato || "";
    return {
        id:          f.id,
        type:        "movie",
        name:        f.name,
        poster:      `https://images.metahub.space/poster/small/${f.id}/img`,
        background:  `https://images.metahub.space/background/medium/${f.id}/img`,
        description: formatos ? `Na tua colecção em: ${formatos}` : undefined,
    };
}

// Para o handler de meta individual: devolve info completa
// incluindo o formato disponível na colecção
function filmeMetaCompleto(f) {
    const formatos = f.formatos ? f.formatos.join(" · ") : f.formato || "";
    return {
        id:          f.id,
        type:        "movie",
        name:        f.name,
        year:        f.year ? parseInt(f.year) : undefined,
        director:    f.director ? [f.director] : undefined,
        genres:      f.genre ? [f.genre] : undefined,
        description: formatos ? `Na tua colecção em: ${formatos}` : undefined,
    };
}

// ── Iniciar servidor ──────────────────────────────────────────────
const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`\n🎬  Videoclube José Santiago — Addon Stremio`);
console.log(`📡  A correr em http://localhost:${PORT}`);
console.log(`📺  Para instalar na TV: http://192.168.1.101:${PORT}/manifest.json`);
console.log(`🔗  Instala no Stremio: http://localhost:${PORT}/manifest.json\n`);
