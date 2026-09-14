import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// LINT.IfChange(aistudio_media_plugin)
function vesselFinderPlugin(): Plugin {
  return {
    name: 'vite-plugin-vesselfinder',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const parsedUrl = new URL(req.url, 'http://localhost');

        if (parsedUrl.pathname === '/api/vesselfinder') {
          const query = parsedUrl.searchParams.get('query') || '';
          if (!query || query.trim().length < 2) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, vessels: [] }));
            return;
          }

          try {
            const https = await import('https');
            const targetUrl = `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(query.trim())}`;
            
            const fetchPromise = new Promise<string>((resolve, reject) => {
              const request = https.get(
                targetUrl,
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                  },
                  timeout: 6000
                },
                (response) => {
                  if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error(`VesselFinder returned HTTP ${response.statusCode}`));
                    return;
                  }
                  let data = '';
                  response.on('data', chunk => data += chunk);
                  response.on('end', () => resolve(data));
                }
              );
              request.on('error', reject);
              request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout'));
              });
            });

            const html = await fetchPromise;
            const rows: any[] = [];
            const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let match;
            while ((match = trRegex.exec(html)) !== null && rows.length < 8) {
              const trContent = match[1];
              const imoMatch = trContent.match(/href="\/vessels\/details\/(\d+)"/i);
              const nameMatch = trContent.match(/<div class="slna">([^<]+)<\/div>/i);
              const typeMatch = trContent.match(/<div class="slty">([^<]+)<\/div>/i);
              const flagMatch = trContent.match(/title="([^"]+)"/i);
              const gtMatch = trContent.match(/<td class="v4[^"]*">([^<]+)<\/td>/i);
              const dwtMatch = trContent.match(/<td class="v5[^"]*">([^<]+)<\/td>/i);
              const dimMatch = trContent.match(/<td class="v6[^"]*">([^<]+)<\/td>/i);

              if (imoMatch && nameMatch) {
                let loa = 0;
                let beam = 0;
                if (dimMatch) {
                  const dims = dimMatch[1].split('/').map(s => parseFloat(s.trim()));
                  loa = dims[0] || 0;
                  beam = dims[1] || 0;
                }

                // Map type to Portuguese VesselType
                const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
                let mappedType = 'carga_geral';
                if (rawType.includes('container')) mappedType = 'porta_conteiner';
                else if (rawType.includes('bulk') || rawType.includes('ore')) mappedType = 'graneleiro';
                else if (rawType.includes('tanker') || rawType.includes('oil') || rawType.includes('crude')) mappedType = 'petroleiro';
                else if (rawType.includes('chemical')) mappedType = 'quimico';
                else if (rawType.includes('lng') || rawType.includes('lpg') || rawType.includes('gas')) mappedType = 'gasoso_gnl_glp';
                else if (rawType.includes('vehicle') || rawType.includes('ro-ro') || rawType.includes('roro')) mappedType = 'ro_ro_veiculos';
                else if (rawType.includes('tug')) mappedType = 'rebocador';

                rows.push({
                  name: nameMatch[1].trim(),
                  imo: imoMatch[1],
                  type: mappedType,
                  typeName: typeMatch ? typeMatch[1].trim() : 'Navio Mercante',
                  flag: flagMatch ? flagMatch[1].trim() : 'Internacional',
                  grossTonnage: gtMatch ? parseInt(gtMatch[1].replace(/\D/g, '')) || 0 : 0,
                  dwt: dwtMatch ? parseInt(dwtMatch[1].replace(/\D/g, '')) || 0 : 0,
                  loa,
                  beam,
                  provider: 'vessel_finder'
                });
              }
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, vessels: rows }));
            return;
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message, vessels: [] }));
            return;
          }
        }

        if (parsedUrl.pathname === '/api/vesselfinder-details') {
          const imo = parsedUrl.searchParams.get('imo') || '';
          if (!imo || imo.trim().length < 4) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'IMO inválido' }));
            return;
          }

          try {
            const https = await import('https');
            const targetUrl = `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(imo.trim())}`;
            const fetchPromise = new Promise<string>((resolve, reject) => {
              const request = https.get(
                targetUrl,
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                  },
                  timeout: 6000
                },
                (response) => {
                  let data = '';
                  response.on('data', chunk => data += chunk);
                  response.on('end', () => resolve(data));
                }
              );
              request.on('error', reject);
              request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout'));
              });
            });

            const html = await fetchPromise;
            const csMatch = html.match(/Callsign<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
            const draftMatch = html.match(/Draught<\/td>\s*<td[^>]*>([\d\.]+)\s*m/i);
            const destMatch = html.match(/Destination<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              callSign: csMatch ? csMatch[1].trim() : '',
              draft: draftMatch ? parseFloat(draftMatch[1]) : 0,
              destination: destMatch ? destMatch[1].trim() : ''
            }));
            return;
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }
        next();
      });
    }
  };
}

function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

export default defineConfig(() => {
  return {
    // Required by Electron file:// loading and Capacitor's local WebView.
    base: './',
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), vesselFinderPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
