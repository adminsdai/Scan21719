const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Agent to bypass strict SSL verification issues if needed for scanning
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Endpoint to scan a URL
app.get('/api/scan', async (req, res) => {
  let { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro de URL' });
  }

  // Basic normalization
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    const startTime = Date.now();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      httpsAgent,
      timeout: 120000,
      maxRedirects: 5
    });

    const scanTimeMs = Date.now() - startTime;
    const html = response.data;
    const headers = response.headers;
    const $ = cheerio.load(html);

    // 1. Analyze Security Headers
    const securityHeaders = {
      hsts: !!(headers['strict-transport-security']),
      csp: !!(headers['content-security-policy']),
      xFrameOptions: !!(headers['x-frame-options']),
      xContentTypeOptions: !!(headers['x-content-type-options']),
      referrerPolicy: !!(headers['referrer-policy']),
      values: {
        hsts: headers['strict-transport-security'] || null,
        csp: headers['content-security-policy'] || null,
        xFrameOptions: headers['x-frame-options'] || null,
        xContentTypeOptions: headers['x-content-type-options'] || null,
        referrerPolicy: headers['referrer-policy'] || null
      }
    };

    // 2. Analyze Cookies
    // Axios response.headers['set-cookie'] can be an array
    const setCookieHeader = headers['set-cookie'] || [];
    const cookies = setCookieHeader.map(cookieStr => {
      const parts = cookieStr.split(';');
      const firstPart = parts[0].split('=');
      const name = firstPart[0].trim();
      const value = firstPart.slice(1).join('=').trim();
      
      const secure = parts.some(p => p.trim().toLowerCase() === 'secure');
      const httpOnly = parts.some(p => p.trim().toLowerCase() === 'httponly');
      const samesite = parts.find(p => p.trim().toLowerCase().startsWith('samesite='));
      
      return {
        name,
        secure,
        httpOnly,
        sameSite: samesite ? samesite.split('=')[1] : 'none',
        raw: cookieStr
      };
    });

    // 3. Search Links (Privacy Policy & Terms)
    const privacyLinks = [];
    const termsLinks = [];
    
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().toLowerCase();
      
      if (!href) return;
      
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
      
      if (isPrivacy) {
        privacyLinks.push({ href, text: $(el).text().trim() });
      }
      if (isTerms) {
        termsLinks.push({ href, text: $(el).text().trim() });
      }
    });

    // Deduplicate links
    const uniquePrivacy = Array.from(new Map(privacyLinks.map(item => [item.href, item])).values());
    const uniqueTerms = Array.from(new Map(termsLinks.map(item => [item.href, item])).values());

    // 4. Analyze Forms
    const forms = [];
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

      forms.push({
        id,
        action,
        inputs,
        hasConsentCheckbox
      });
    });

    // 5. Analyze Tracking Scripts
    const trackers = [];
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

        if (matched) {
          trackers.push({
            name: t.name,
            category: t.category,
            source: src ? 'external' : 'inline',
            url: src || 'Script inline'
          });
        }
      });
    });

    // Deduplicate trackers
    const uniqueTrackers = Array.from(new Map(trackers.map(item => [item.name, item])).values());

    // 6. Check Consent Banner indicators (e.g. Cookiebot, OneTrust, custom banners)
    let hasCookieBannerIndicator = false;
    const cookieBannerPatterns = [
      /cookie/i, /consent/i, /cookie-banner/i, /cookie-notice/i, /cookie-law/i,
      /onetrust/i, /cookiebot/i, /osano/i, /didomi/i, /usercentrics/i, /privy/i
    ];
    
    // Check IDs, classes and scripts
    $('[id], [class]').each((i, el) => {
      const id = $(el).attr('id') || '';
      const className = $(el).attr('class') || '';
      
      const matches = cookieBannerPatterns.some(p => p.test(id) || p.test(className));
      if (matches) {
        hasCookieBannerIndicator = true;
      }
    });

    // 7. Calculate Compliance Score (Ley 21.719)
    let score = 100;
    const deductions = [];

    // Privacy Policy: 20 pts
    if (uniquePrivacy.length === 0) {
      score -= 20;
      deductions.push({
        points: 20,
        area: 'Políticas de Privacidad',
        detail: 'No se detectó un enlace a la Política de Privacidad del sitio. El Art. 14 ter de la Ley 21.719 exige de forma obligatoria que las políticas y prácticas sobre el tratamiento de datos estén permanentemente accesibles al público.'
      });
    }

    // Terms & Conditions: 10 pts
    if (uniqueTerms.length === 0) {
      score -= 10;
      deductions.push({
        points: 10,
        area: 'Términos y Condiciones',
        detail: 'No se encontraron Términos y Condiciones. Aunque no siempre son obligatorios para todo tipo de tratamiento, son altamente recomendados para establecer el contrato de uso y límites de responsabilidad.'
      });
    }

    // Forms without Consent checkbox: 25 pts (or proportion)
    if (forms.length > 0) {
      const formsWithoutConsent = forms.filter(f => !f.hasConsentCheckbox);
      if (formsWithoutConsent.length > 0) {
        const deductionPoints = Math.min(25, formsWithoutConsent.length * 15);
        score -= deductionPoints;
        deductions.push({
          points: deductionPoints,
          area: 'Consentimiento en Formularios',
          detail: `${formsWithoutConsent.length} de los ${forms.length} formulario(s) detectados recolectan datos (ej: nombres, correos) sin un checkbox de consentimiento explícito e informado. Bajo la nueva ley, el consentimiento debe ser libre, específico, previo e inequívoco (Art. 12).`
        });
      }
    }

    // Security Headers: 20 pts (5 pts per header)
    const missingHeaders = [];
    if (!securityHeaders.hsts) { score -= 5; missingHeaders.push('HSTS (Strict-Transport-Security)'); }
    if (!securityHeaders.csp) { score -= 5; missingHeaders.push('Content-Security-Policy (CSP)'); }
    if (!securityHeaders.xFrameOptions) { score -= 5; missingHeaders.push('X-Frame-Options'); }
    if (!securityHeaders.xContentTypeOptions) { score -= 5; missingHeaders.push('X-Content-Type-Options'); }
    
    if (missingHeaders.length > 0) {
      deductions.push({
        points: missingHeaders.length * 5,
        area: 'Seguridad Técnica',
        detail: `Faltan cabeceras de seguridad clave: ${missingHeaders.join(', ')}. El principio de seguridad (Art. 3, letra f) exige resguardar los datos contra tratamientos no autorizados o filtraciones.`
      });
    }

    // Trackers and Cookie Banner: 25 pts
    if (uniqueTrackers.length > 0 && !hasCookieBannerIndicator) {
      score -= 25;
      deductions.push({
        points: 25,
        area: 'Cookies y Seguimiento',
        detail: `Se detectaron scripts de seguimiento (${uniqueTrackers.map(t => t.name).join(', ')}), pero no se encontró un banner de consentimiento para la gestión de cookies. Instalar cookies de analítica o marketing requiere el consentimiento inequívoco del usuario antes de su activación.`
      });
    } else if (uniqueTrackers.length > 0 && hasCookieBannerIndicator) {
      // Banners are present, but let's encourage granular options
      score -= 5;
      deductions.push({
        points: 5,
        area: 'Configuración de Cookies',
        detail: 'Se detectaron cookies y un banner de consentimiento. Recuerde que la Ley 21.719 prohíbe las casillas pre-marcadas por defecto para cookies no esenciales, requiriendo opciones granulares de aceptación (Art. 12).'
      });
    }

    // Ensure score is not negative
    score = Math.max(0, score);

    res.json({
      url,
      scanTimeMs,
      timestamp: new Date().toISOString(),
      score,
      deductions,
      summary: {
        privacyPolicyFound: uniquePrivacy.length > 0,
        termsFound: uniqueTerms.length > 0,
        cookieBannerFound: hasCookieBannerIndicator,
        formCount: forms.length,
        trackerCount: uniqueTrackers.length,
      },
      details: {
        privacyLinks: uniquePrivacy,
        termsLinks: uniqueTerms,
        cookies,
        securityHeaders,
        forms,
        trackers: uniqueTrackers
      }
    });

  } catch (error) {
    console.error('Scan Error:', error.message);
    res.status(500).json({
      error: 'Error al escanear la URL',
      details: error.message
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
