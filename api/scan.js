const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async (req, res) => {
  let { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro de URL' });
  }

  // Basic normalization
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    const startScanTime = Date.now();
    const parsedBase = new URL(url);
    const baseHost = parsedBase.hostname.replace(/^www\./i, '');
    const baseOrigin = parsedBase.origin;
    const baseProtocol = parsedBase.protocol;

    const visited = new Set();
    const queue = [baseOrigin]; // Start crawling from origin

    // Global accumulated records
    const allScannedPages = [];
    const allForms = [];
    const allTrackers = [];
    const allCookies = [];
    const allPrivacyLinks = [];
    const allTermsLinks = [];
    let hasCookieBannerIndicator = false;
    
    // Per-page header storage
    const pageHeadersStatus = {};

    const maxPages = 15; // Limit to 15 pages to keep scanning fast and safe

    while (queue.length > 0 && visited.size < maxPages) {
      const currentUrl = queue.shift();
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      allScannedPages.push(currentUrl);

      try {
        const response = await axios.get(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          httpsAgent,
          timeout: 15000, // 15 seconds timeout per page
          maxRedirects: 3
        });

        const html = response.data;
        const headers = response.headers;
        const $ = cheerio.load(html);

        // A. Analyze page security headers
        const pageHsts = !!(headers['strict-transport-security']);
        const pageCsp = !!(headers['content-security-policy']);
        const pageXFrame = !!(headers['x-frame-options']);
        const pageXContentType = !!(headers['x-content-type-options']);
        const pageReferrer = !!(headers['referrer-policy']);

        pageHeadersStatus[currentUrl] = {
          hsts: pageHsts,
          csp: pageCsp,
          xFrameOptions: pageXFrame,
          xContentTypeOptions: pageXContentType,
          referrerPolicy: pageReferrer,
          values: {
            hsts: headers['strict-transport-security'] || null,
            csp: headers['content-security-policy'] || null,
            xFrameOptions: headers['x-frame-options'] || null,
            xContentTypeOptions: headers['x-content-type-options'] || null,
            referrerPolicy: headers['referrer-policy'] || null
          }
        };

        // B. Analyze page cookies
        const setCookieHeader = headers['set-cookie'] || [];
        const cookiesArr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        cookiesArr.forEach(cookieStr => {
          if (!cookieStr || typeof cookieStr !== 'string') return;
          const parts = cookieStr.split(';');
          const firstPart = parts[0].split('=');
          const name = firstPart[0].trim();
          
          const secure = parts.some(p => p.trim().toLowerCase() === 'secure');
          const httpOnly = parts.some(p => p.trim().toLowerCase() === 'httponly');
          const samesite = parts.find(p => p.trim().toLowerCase().startsWith('samesite='));

          // Add to cookies array if not already present
          if (!allCookies.some(c => c.name === name)) {
            allCookies.push({
              name,
              secure,
              httpOnly,
              sameSite: samesite ? samesite.split('=')[1] : 'none',
              pageUrl: currentUrl
            });
          }
        });

        // C. Parse Links & build BFS queue
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim().toLowerCase();
          
          if (!href) return;

          // Normalize absolute/relative url
          let normalized = null;
          try {
            if (href.startsWith('http://') || href.startsWith('https://')) {
              normalized = new URL(href);
            } else if (href.startsWith('//')) {
              normalized = new URL(baseProtocol + href);
            } else if (!href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#')) {
              normalized = new URL(href, baseOrigin);
            }
          } catch (e) {
            normalized = null;
          }

          if (normalized) {
            normalized.hash = ''; // Remove hash
            const normalizedStr = normalized.toString().replace(/\/$/, ''); // Remove trailing slash
            const normalizedHost = normalized.hostname.replace(/^www\./i, '');
            
            // Queue internal links
            if (normalizedHost === baseHost && !visited.has(normalizedStr) && !queue.includes(normalizedStr)) {
              queue.push(normalizedStr);
            }

            // Detect legal links
            const isPrivacy = href.toLowerCase().includes('privac') || 
                              href.toLowerCase().includes('privacy') || 
                              href.toLowerCase().includes('legal') || 
                              href.toLowerCase().includes('politica') ||
                              text.includes('privacid') || 
                              text.includes('privacy') || 
                              text.includes('política') || 
                              text.includes('legal');
                              
            const isTerms = href.toLowerCase().includes('termino') || 
                            href.toLowerCase().includes('condic') || 
                            href.toLowerCase().includes('terms') || 
                            href.toLowerCase().includes('condition') ||
                            text.includes('término') || 
                            text.includes('condición') || 
                            text.includes('terms') || 
                            text.includes('condiciones');

            if (isPrivacy && !allPrivacyLinks.some(l => l.href === href)) {
              allPrivacyLinks.push({ href, text: $(el).text().trim(), pageUrl: currentUrl });
            }
            if (isTerms && !allTermsLinks.some(l => l.href === href)) {
              allTermsLinks.push({ href, text: $(el).text().trim(), pageUrl: currentUrl });
            }
          }
        });

        // D. Analyze Forms
        $('form').each((formIdx, formEl) => {
          const inputs = [];
          const id = $(formEl).attr('id') || `form-${formIdx}`;
          const action = $(formEl).attr('action') || '';
          
          $(formEl).find('input, select, textarea').each((inputIdx, inputEl) => {
            const type = $(inputEl).attr('type') || inputEl.tagName.toLowerCase();
            const name = $(inputEl).attr('name') || '';
            const placeholder = $(inputEl).attr('placeholder') || '';
            
            if (type !== 'submit' && type !== 'button') {
              inputs.push({ type, name, placeholder });
            }
          });

          // Check for consent checkbox
          let hasConsentCheckbox = false;
          const checkboxes = $(formEl).find('input[type="checkbox"]');
          checkboxes.each((cIdx, cbEl) => {
            const parentText = $(cbEl).parent().text().toLowerCase();
            const labelText = $(formEl).find(`label[for="${$(cbEl).attr('id')}"]`).text().toLowerCase();
            const combinedText = parentText + " " + labelText;
            
            if (combinedText.includes('acept') || 
                combinedText.includes('consent') || 
                combinedText.includes('privac') || 
                combinedText.includes('ley') || 
                combinedText.includes('condicion') ||
                combinedText.includes('dat')) {
              hasConsentCheckbox = true;
            }
          });

          // Check if this form is already collected to avoid duplicates
          const inputsKey = inputs.map(i => i.name + i.type).join('-');
          if (!allForms.some(f => f.id === id && f.inputsKey === inputsKey)) {
            allForms.push({
              id,
              action,
              inputs,
              inputsKey,
              hasConsentCheckbox,
              pageUrl: currentUrl
            });
          }
        });

        // E. Analyze Tracking Scripts
        const trackingPatterns = [
          { name: 'Google Tag Manager', pattern: /googletagmanager\.com/i, category: 'Marketing/Analytics' },
          { name: 'Google Analytics', pattern: /google-analytics\.com|analytics\.js|gtag/i, category: 'Analytics' },
          { name: 'Meta Pixel (Facebook)', pattern: /connect\.facebook\.net|fbevents\.js/i, category: 'Marketing' },
          { name: 'Hotjar', pattern: /hotjar\.com|static\.hotjar/i, category: 'Analytics' },
          { name: 'HubSpot', pattern: /js\.hs-scripts\.com|js\.hsadspixel\.net/i, category: 'Marketing/CRM' },
          { name: 'TikTok Pixel', pattern: /tiktok\.com\/sdk/i, category: 'Marketing' }
        ];

        $('script').each((i, el) => {
          const src = $(el).attr('src');
          const content = $(el).html();

          trackingPatterns.forEach(t => {
            let matched = false;
            if (src && t.pattern.test(src)) matched = true;
            if (content && t.pattern.test(content)) matched = true;

            if (matched && !allTrackers.some(tr => tr.name === t.name)) {
              allTrackers.push({
                name: t.name,
                category: t.category,
                source: src ? 'external' : 'inline',
                url: src || 'Script inline',
                pageUrl: currentUrl
              });
            }
          });
        });

        // F. Cookie banner indicator
        const cookieBannerPatterns = [
          /cookie/i, /consent/i, /cookie-banner/i, /cookie-notice/i, /cookie-law/i,
          /onetrust/i, /cookiebot/i, /osano/i, /didomi/i, /usercentrics/i, /privy/i
        ];
        
        $('[id], [class]').each((i, el) => {
          const id = $(el).attr('id') || '';
          const className = $(el).attr('class') || '';
          const matches = cookieBannerPatterns.some(p => p.test(id) || p.test(className));
          if (matches) {
            hasCookieBannerIndicator = true;
          }
        });

      } catch (err) {
        console.error(`Crawl failed for ${currentUrl}:`, err.message);
        pageHeadersStatus[currentUrl] = { error: err.message };
      }
    }

    const totalCrawlTimeMs = Date.now() - startScanTime;

    // Recalculate consolidated Compliance Score
    let score = 100;
    const deductions = [];

    // Privacy Policy: 20 pts
    if (allPrivacyLinks.length === 0) {
      score -= 20;
      deductions.push({
        points: 20,
        area: 'Políticas de Privacidad',
        detail: 'No se detectó ningún enlace a la Política de Privacidad en ninguna de las páginas rastreadas. El Art. 14 ter de la Ley 21.719 exige que las políticas sobre tratamiento de datos estén permanentemente accesibles al público.'
      });
    }

    // Terms & Conditions: 10 pts
    if (allTermsLinks.length === 0) {
      score -= 10;
      deductions.push({
        points: 10,
        area: 'Términos y Condiciones',
        detail: 'No se encontraron enlaces a Términos y Condiciones en el sitio rastreado. Aunque no es explícitamente obligatorio por ley para todo sitio, es clave para establecer los términos del contrato de tratamiento.'
      });
    }

    // Forms without consent: 25 pts (proportional to total forms)
    if (allForms.length > 0) {
      const formsWithoutConsent = allForms.filter(f => !f.hasConsentCheckbox);
      if (formsWithoutConsent.length > 0) {
        const deductionPoints = Math.min(25, formsWithoutConsent.length * 15);
        score -= deductionPoints;
        deductions.push({
          points: deductionPoints,
          area: 'Consentimiento en Formularios',
          detail: `${formsWithoutConsent.length} de los ${allForms.length} formulario(s) detectados recolectan datos personales en el sitio sin un checkbox de consentimiento explícito, previo e informado (infracción al Art. 12).`
        });
      }
    }

    // Security Headers: 20 pts (5 pts per missing header on root origin)
    const rootUrlNormalized = baseOrigin.replace(/\/$/, '');
    const rootHeaders = pageHeadersStatus[rootUrlNormalized] || pageHeadersStatus[url.replace(/\/$/, '')] || Object.values(pageHeadersStatus)[0] || {};
    const missingHeaders = [];
    if (!rootHeaders.hsts) { score -= 5; missingHeaders.push('HSTS (Strict-Transport-Security)'); }
    if (!rootHeaders.csp) { score -= 5; missingHeaders.push('Content-Security-Policy (CSP)'); }
    if (!rootHeaders.xFrameOptions) { score -= 5; missingHeaders.push('X-Frame-Options'); }
    if (!rootHeaders.xContentTypeOptions) { score -= 5; missingHeaders.push('X-Content-Type-Options'); }
    
    if (missingHeaders.length > 0) {
      deductions.push({
        points: missingHeaders.length * 5,
        area: 'Seguridad Técnica',
        detail: `Faltan cabeceras de seguridad clave en el dominio principal: ${missingHeaders.join(', ')}. El principio de seguridad (Art. 3, letra f) exige salvaguardar el sitio contra filtraciones o malware.`
      });
    }

    // Trackers and Cookie Banner: 25 pts
    if (allTrackers.length > 0 && !hasCookieBannerIndicator) {
      score -= 25;
      deductions.push({
        points: 25,
        area: 'Cookies y Seguimiento',
        detail: `Se detectaron scripts de seguimiento de terceros (${allTrackers.map(t => t.name).join(', ')}), pero no se encontró un banner de consentimiento de cookies. Bajo la Ley 21.719, las cookies no esenciales requieren la autorización expresa del usuario antes de instalarse.`
      });
    } else if (allTrackers.length > 0 && hasCookieBannerIndicator) {
      score -= 5;
      deductions.push({
        points: 5,
        area: 'Configuración de Cookies',
        detail: 'Se detectaron cookies y un banner de consentimiento. Asegúrate de que el banner ofrezca aceptación granular por tipo de cookie y que no tenga casillas pre-marcadas por defecto (Art. 12).'
      });
    }

    score = Math.max(0, score);

    res.json({
      url,
      scanTimeMs: totalCrawlTimeMs,
      timestamp: new Date().toISOString(),
      score,
      deductions,
      summary: {
        privacyPolicyFound: allPrivacyLinks.length > 0,
        termsFound: allTermsLinks.length > 0,
        cookieBannerFound: hasCookieBannerIndicator,
        formCount: allForms.length,
        trackerCount: allTrackers.length,
        pagesScannedCount: allScannedPages.length
      },
      details: {
        scannedPages: allScannedPages,
        privacyLinks: allPrivacyLinks,
        termsLinks: allTermsLinks,
        cookies: allCookies,
        securityHeaders: rootHeaders,
        pageHeadersStatus,
        forms: allForms,
        trackers: allTrackers
      }
    });

  } catch (error) {
    console.error('Crawl Endpoint Error:', error.message);
    res.status(500).json({
      error: 'Error al realizar el escaneo del dominio',
      details: error.message
    });
  }
};
