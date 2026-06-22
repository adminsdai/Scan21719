document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // 1. Navigation Logic
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });

    // 2. Countdown Timer (December 1, 2026)
    const targetDate = new Date('2026-12-01T00:00:00-03:00').getTime(); // Chile Time

    function updateCountdown() {
        const now = new Date().getTime();
        const difference = targetDate - now;

        if (difference <= 0) {
            document.getElementById('countdown').innerHTML = '<strong>¡EN VIGENCIA!</strong>';
            return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        document.getElementById('days').innerText = String(days).padStart(3, '0');
        document.getElementById('hours').innerText = String(hours).padStart(2, '0');
        document.getElementById('minutes').innerText = String(minutes).padStart(2, '0');
        document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // 3. Scan & Results Logic
    const scanForm = document.getElementById('scan-form');
    const urlInput = document.getElementById('url-input');
    const scanBtn = document.getElementById('scan-btn');
    const progressCard = document.getElementById('progress-card');
    const initialInfoCard = document.getElementById('initial-info-card');
    const resultsCard = document.getElementById('results-card');
    const reportDetailCard = document.getElementById('report-detail-card');
    const stepItems = document.querySelectorAll('.step-list .step-item');
    const progressFill = document.getElementById('progress-fill');

    // Preset buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            urlInput.value = btn.dataset.url;
            scanForm.dispatchEvent(new Event('submit'));
        });
    });

    // Sub-tabs in report detail
    const reportTabBtns = document.querySelectorAll('.tabs-header .tab-btn');
    const reportTabPanes = document.querySelectorAll('.tabs-container .tab-pane');

    reportTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            reportTabBtns.forEach(b => b.classList.remove('active'));
            reportTabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Scan form submission
    scanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawUrl = urlInput.value.trim();
        if (!rawUrl) return;

        // Reset UI state for new scan
        initialInfoCard.classList.remove('hidden');
        resultsCard.classList.add('hidden');
        reportDetailCard.classList.add('hidden');
        progressCard.classList.remove('hidden');
        scanBtn.disabled = true;
        scanBtn.querySelector('span').innerText = 'Escaneando...';
        
        // Reset steps
        stepItems.forEach(item => {
            item.classList.remove('active', 'completed');
            item.querySelector('.step-status').setAttribute('data-lucide', 'circle-dashed');
        });
        progressFill.style.width = '0%';
        lucide.createIcons();

        // Animation steps config
        const totalSteps = stepItems.length;
        let currentStep = 0;

        function advanceStep() {
            if (currentStep < totalSteps) {
                // Mark previous as completed
                if (currentStep > 0) {
                    const prevStep = document.getElementById(`step-${currentStep - 1}`);
                    prevStep.classList.remove('active');
                    prevStep.classList.add('completed');
                    prevStep.querySelector('.step-status').setAttribute('data-lucide', 'check-circle-2');
                    // Reset step 5 HTML text upon completion
                    if (currentStep - 1 === 5) {
                        prevStep.innerHTML = '<i data-lucide="check-circle-2" class="step-status"></i> Detectando cookies y scripts de seguimiento...';
                    }
                }
                
                // Mark current as active
                const activeStep = document.getElementById(`step-${currentStep}`);
                activeStep.classList.add('active');
                activeStep.querySelector('.step-status').setAttribute('data-lucide', 'loader-2');
                
                // Animate recursive page crawl count at step 5
                if (currentStep === 5) {
                    let pageCount = 1;
                    const pageCrawlInterval = setInterval(() => {
                        if (currentStep === 6) {
                            clearInterval(pageCrawlInterval);
                            return;
                        }
                        if (pageCount < 15) {
                            pageCount += Math.floor(Math.random() * 2) + 1;
                            activeStep.innerHTML = `<i data-lucide="loader-2" class="step-status"></i> Detectando cookies y scripts de seguimiento... (Rastreadas: ${pageCount} páginas)`;
                            lucide.createIcons();
                        } else {
                            clearInterval(pageCrawlInterval);
                        }
                    }, 180);
                }
                
                // Update bar
                const percentage = ((currentStep + 1) / totalSteps) * 100;
                progressFill.style.width = `${percentage}%`;
                
                currentStep++;
                lucide.createIcons();
            }
        }

        // Run animation steps visually before completing (takes ~3.5s total for realistic interface)
        const stepInterval = setInterval(() => {
            if (currentStep < totalSteps - 1) {
                advanceStep();
            } else {
                clearInterval(stepInterval);
            }
        }, 500);

        try {
            // Registrar consentimiento inmutable antes de escanear
            fetch('/api/consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url_scanned: rawUrl, 
                    user_agent: navigator.userAgent 
                })
            }).catch(e => console.error('Consent logging failed:', e));

            // Make actual API scan call
            const response = await fetch(`/api/scan?url=${encodeURIComponent(rawUrl)}`);
            const data = await response.json();

            // Clear the mock interval if it's still running, and fast forward
            clearInterval(stepInterval);
            
            // Mark all steps as complete rapidly
            for (let i = currentStep; i < totalSteps; i++) {
                const step = document.getElementById(`step-${i}`);
                step.classList.add('completed');
                step.querySelector('.step-status').setAttribute('data-lucide', 'check-circle-2');
            }
            progressFill.style.width = '100%';
            lucide.createIcons();

            // Render Results after a small delay
            setTimeout(() => {
                progressCard.classList.add('hidden');
                initialInfoCard.classList.add('hidden');
                resultsCard.classList.remove('hidden');
                reportDetailCard.classList.remove('hidden');
                
                renderScanResults(data);
                
                scanBtn.disabled = false;
                scanBtn.querySelector('span').innerText = 'Iniciar Escaneo';
            }, 800);

        } catch (error) {
            console.error(error);
            clearInterval(stepInterval);
            
            // Show error in the step progress
            const errorStep = document.getElementById(`step-${Math.min(currentStep, totalSteps - 1)}`);
            errorStep.classList.add('active');
            errorStep.querySelector('.step-status').setAttribute('data-lucide', 'x-circle');
            errorStep.querySelector('.step-status').classList.add('text-danger');
            errorStep.style.color = 'var(--color-danger)';
            lucide.createIcons();

            alert('Ocurrió un error al intentar conectarse y escanear el sitio. Por favor, verifica la URL e inténtalo de nuevo.');
            
            scanBtn.disabled = false;
            scanBtn.querySelector('span').innerText = 'Iniciar Escaneo';
        }
    });

    // Render results helper
    function renderScanResults(data) {
        // Score Gauge Animation
        const scoreVal = document.getElementById('score-val');
        const scoreFill = document.getElementById('score-fill');
        const score = data.score;
        
        // Counter animation
        let count = 0;
        const countSpeed = Math.max(1, Math.floor(score / 50));
        const scoreInterval = setInterval(() => {
            if (count < score) {
                count += countSpeed;
                if (count > score) count = score;
                scoreVal.innerText = count;
            } else {
                clearInterval(scoreInterval);
                scoreVal.innerText = score;
            }
        }, 15);

        // SVG stroke-dashoffset formula (radius is 45, perimeter is 282.7)
        const offset = 282.7 - (282.7 * score) / 100;
        scoreFill.style.strokeDashoffset = offset;
        
        // Color mapping for score
        if (score >= 85) {
            scoreFill.style.stroke = 'var(--color-success)';
        } else if (score >= 50) {
            scoreFill.style.stroke = 'var(--color-warning)';
        } else {
            scoreFill.style.stroke = 'var(--color-danger)';
        }

        // Status badge
        const siteTitle = document.getElementById('site-title-result');
        const scanDate = document.getElementById('scan-date-val');
        const statusBadge = document.getElementById('status-badge-val');
        
        siteTitle.innerText = data.url;
        scanDate.innerText = new Date(data.timestamp).toLocaleString();
        
        statusBadge.className = 'status-badge';
        if (score >= 85) {
            statusBadge.classList.add('compliant');
            statusBadge.innerText = 'Cumple';
        } else if (score >= 50) {
            statusBadge.classList.add('warning');
            statusBadge.innerText = 'Advertencia';
        } else {
            statusBadge.classList.add('critical');
            statusBadge.innerText = 'Crítico';
        }

        // Stats boxes
        document.getElementById('stat-forms').innerText = data.summary.formCount;
        document.getElementById('stat-trackers').innerText = data.summary.trackerCount;
        document.getElementById('stat-policies').innerText = (data.summary.privacyPolicyFound ? 1 : 0) + (data.summary.termsFound ? 1 : 0);
        document.getElementById('stat-pages').innerText = data.summary.pagesScannedCount;
        
        const headerCount = (data.details.securityHeaders.hsts ? 1 : 0) + 
                            (data.details.securityHeaders.csp ? 1 : 0) + 
                            (data.details.securityHeaders.xFrameOptions ? 1 : 0) + 
                            (data.details.securityHeaders.xContentTypeOptions ? 1 : 0);
        document.getElementById('stat-headers').innerText = `${headerCount}/4`;

        // Populate Scanned Pages List
        const pagesList = document.getElementById('scanned-pages-list');
        pagesList.innerHTML = '';
        data.details.scannedPages.forEach(p => {
            const shortUrl = p.replace(/^https?:\/\/(www\.)?/, '');
            pagesList.innerHTML += `
                <li style="display:flex; align-items:center; gap:6px;">
                    <i data-lucide="check" class="text-success" style="width:12px; height:12px;"></i>
                    <a href="${p}" target="_blank" style="color:var(--text-muted); text-decoration:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%;">${shortUrl}</a>
                </li>
            `;
        });

        // 1. POPULATE TAB: FORMS
        const formsBody = document.querySelector('#forms-table tbody');
        formsBody.innerHTML = '';
        if (data.details.forms.length === 0) {
            formsBody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">No se detectaron formularios que recolecten datos personales en este sitio.</td></tr>`;
        } else {
            data.details.forms.forEach(f => {
                const inputsText = f.inputs.map(i => `${i.name || i.type} (${i.type})`).join(', ') || 'Sin campos legibles';
                const consentBadge = f.hasConsentCheckbox ? 
                    `<span class="badge-status success"><i data-lucide="check"></i> Detectada</span>` : 
                    `<span class="badge-status danger"><i data-lucide="x"></i> Faltante</span>`;
                const statusText = f.hasConsentCheckbox ? 
                    `<span class="text-success">Conforme (Art. 12)</span>` : 
                    `<span class="text-danger">Riesgo Crítico (Tratamiento sin consentimiento previo)</span>`;
                
                const pageUrlShort = f.pageUrl.replace(/^https?:\/\/(www\.)?/, '');
                
                formsBody.innerHTML += `
                    <tr>
                        <td><strong>#${f.id}</strong></td>
                        <td>${inputsText}</td>
                        <td style="font-family:monospace; font-size:0.75rem;"><a href="${f.pageUrl}" target="_blank" class="text-primary">${pageUrlShort}</a></td>
                        <td>${consentBadge}</td>
                        <td>${statusText}</td>
                    </tr>
                `;
            });
        }

        // 2. POPULATE TAB: POLICIES
        const policiesBody = document.querySelector('#policies-table tbody');
        policiesBody.innerHTML = '';
        
        // Privacy Policy row
        const privacyStatusBadge = data.summary.privacyPolicyFound ? 
            `<span class="badge-status success"><i data-lucide="check"></i> Detectado</span>` : 
            `<span class="badge-status danger"><i data-lucide="x"></i> Faltante</span>`;
        const privacyLinkText = data.summary.privacyPolicyFound ? 
            data.details.privacyLinks.map(l => `<a href="${l.href}" target="_blank" class="text-primary">${l.text || l.href}</a>`).join('<br>') : 
            '<span class="text-muted">Ninguno</span>';
        const privacyPages = data.summary.privacyPolicyFound ? 
            data.details.privacyLinks.map(l => l.pageUrl.replace(/^https?:\/\/(www\.)?/, '')).join('<br>') : 
            '<span class="text-muted">-</span>';
        const privacyAction = data.summary.privacyPolicyFound ? 
            '<span class="text-success">Ninguna requerida</span>' : 
            `<button class="btn btn-outline btn-sm" onclick="document.querySelector('[data-target=resources-tab]').click()"><i data-lucide="plus"></i> Generar Política</button>`;

        policiesBody.innerHTML += `
            <tr>
                <td><strong>Política de Privacidad (Art. 14 ter)</strong></td>
                <td>${privacyStatusBadge}</td>
                <td>${privacyLinkText}</td>
                <td style="font-family:monospace; font-size:0.75rem;">${privacyPages}</td>
                <td>${privacyAction}</td>
            </tr>
        `;

        // Terms row
        const termsStatusBadge = data.summary.termsFound ? 
            `<span class="badge-status success"><i data-lucide="check"></i> Detectado</span>` : 
            `<span class="badge-status warning"><i data-lucide="alert-circle"></i> Recomendado</span>`;
        const termsLinkText = data.summary.termsFound ? 
            data.details.termsLinks.map(l => `<a href="${l.href}" target="_blank" class="text-primary">${l.text || l.href}</a>`).join('<br>') : 
            '<span class="text-muted">Ninguno</span>';
        const termsPages = data.summary.termsFound ? 
            data.details.termsLinks.map(l => l.pageUrl.replace(/^https?:\/\/(www\.)?/, '')).join('<br>') : 
            '<span class="text-muted">-</span>';
        const termsAction = data.summary.termsFound ? 
            '<span class="text-success">Ninguna requerida</span>' : 
            '<span class="text-muted">Crear documento contractual</span>';

        policiesBody.innerHTML += `
            <tr>
                <td><strong>Términos y Condiciones del Sitio</strong></td>
                <td>${termsStatusBadge}</td>
                <td>${termsLinkText}</td>
                <td style="font-family:monospace; font-size:0.75rem;">${termsPages}</td>
                <td>${termsAction}</td>
            </tr>
        `;

        // 3. POPULATE TAB: COOKIES & TRACKERS
        const cookiesBody = document.querySelector('#cookies-table tbody');
        cookiesBody.innerHTML = '';
        if (data.details.trackers.length === 0) {
            cookiesBody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;">No se detectaron scripts de seguimiento de terceros comunes en el sitio.</td></tr>`;
        } else {
            data.details.trackers.forEach(t => {
                const pageUrlShort = t.pageUrl.replace(/^https?:\/\/(www\.)?/, '');
                cookiesBody.innerHTML += `
                    <tr>
                        <td><strong>${t.name}</strong></td>
                        <td>${t.category}</td>
                        <td><span class="badge-status warning">${t.source}</span></td>
                        <td style="font-family:monospace; font-size:0.75rem;"><a href="${t.pageUrl}" target="_blank" class="text-primary">${pageUrlShort}</a></td>
                        <td style="font-family:monospace; font-size:0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.url}</td>
                    </tr>
                `;
            });
        }

        const bannerBox = document.getElementById('banner-status-box-val');
        bannerBox.className = 'banner-status-box';
        if (data.summary.cookieBannerFound) {
            bannerBox.classList.add('badge-status', 'success');
            bannerBox.innerHTML = `<i data-lucide="check-circle-2"></i> <strong>Se detectó un indicador de Banner de Cookies o CMP:</strong> Esto ayuda a cumplir con la exigencia de consentimiento explícito previo, siempre y cuando no se precarguen cookies no esenciales antes de que el usuario las acepte.`;
        } else if (data.details.trackers.length > 0) {
            bannerBox.classList.add('badge-status', 'danger');
            bannerBox.innerHTML = `<i data-lucide="x-circle"></i> <strong>¡ATENCIÓN! Rastreadores activos sin Banner de Consentimiento:</strong> Se detectaron scripts de analítica/marketing pero ningún banner para configurarlos. Esto constituye una infracción bajo la Ley 21.719 al recopilar datos de navegación sin autorización del titular.`;
        } else {
            bannerBox.classList.add('badge-status', 'warning');
            bannerBox.innerHTML = `<i data-lucide="alert-circle"></i> No se encontraron scripts de seguimiento de terceros ni banner de consentimiento de cookies. Si agregas herramientas de analítica (como Google Analytics) o píxeles de marketing, debes implementar un banner de consentimiento obligatoriamente.`;
        }

        // 4. POPULATE TAB: SECURITY HEADERS
        const headersGrid = document.getElementById('headers-status-grid-val');
        headersGrid.innerHTML = '';
        
        const sh = data.details.securityHeaders;
        const headersList = [
            { name: 'Content-Security-Policy (CSP)', present: sh.csp, value: sh.values.csp, desc: 'Protege contra ataques de inyección de código (XSS) indicando de qué dominios se permite cargar scripts.' },
            { name: 'Strict-Transport-Security (HSTS)', present: sh.hsts, value: sh.values.hsts, desc: 'Fuerza todas las conexiones al servidor a realizarse bajo protocolo seguro HTTPS en lugar de HTTP plano.' },
            { name: 'X-Frame-Options', present: sh.xFrameOptions, value: sh.values.xFrameOptions, desc: 'Evita ataques de secuestro de clic (Clickjacking) impidiendo que tu sitio sea cargado dentro de marcos de otros sitios.' },
            { name: 'X-Content-Type-Options', present: sh.xContentTypeOptions, value: sh.values.xContentTypeOptions, desc: 'Previene el olfateo de tipos MIME (MIME-sniffing), forzando al navegador a seguir los tipos declarados por el servidor.' }
        ];

        headersList.forEach(h => {
            const statusBadge = h.present ? 
                `<span class="badge-status success"><i data-lucide="check"></i> Activo</span>` : 
                `<span class="badge-status danger"><i data-lucide="x"></i> Inactivo</span>`;
            
            headersGrid.innerHTML += `
                <div class="header-status-item">
                    <div>
                        <div class="header-name">${h.name}</div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; max-width: 90%; line-height: 1.3;">${h.desc}</p>
                        ${h.value ? `<div class="header-val" style="margin-top:8px;">Valor: <code>${h.value}</code></div>` : ''}
                    </div>
                    <div>${statusBadge}</div>
                </div>
            `;
        });

        // 5. RENDER RECOMMENDATIONS LIST
        const recList = document.getElementById('recommendations-list');
        recList.innerHTML = '';

        if (data.deductions.length === 0) {
            recList.innerHTML = `
                <div class="badge-status success" style="padding: 15px; width: 100%;">
                    <i data-lucide="check-circle-2"></i> ¡Excelente! Tu sitio cumple con todas las validaciones básicas de nuestro escáner relativas a la Ley 21.719. Recuerda mantener tus políticas actualizadas.
                </div>
            `;
        } else {
            data.deductions.forEach(d => {
                recList.innerHTML += `
                    <div class="rec-item">
                        <div class="rec-item-points">-${d.points} pts</div>
                        <div>
                            <div class="rec-item-title">${d.area}</div>
                            <div class="rec-item-desc">${d.detail}</div>
                        </div>
                    </div>
                `;
            });
        }

        lucide.createIcons();
    }

    // 4. Print Report Logic
    document.getElementById('print-report-btn').addEventListener('click', () => {
        window.print();
    });

    // 5. Privacy Policy Generator Logic
    const policyForm = document.getElementById('policy-form');
    const policyResultBox = document.getElementById('policy-result-box');
    const policyText = document.getElementById('policy-text');
    const copyPolicyBtn = document.getElementById('copy-policy-btn');

    policyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const compName = document.getElementById('comp-name').value.trim();
        const compEmail = document.getElementById('comp-email').value.trim();
        const compAddress = document.getElementById('comp-address').value.trim();
        
        const dateStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

        const template = `POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS PERSONALES
Sitio Web de: ${compName}
Fecha de Última Actualización: ${dateStr}

1. PRESENTACIÓN Y OBJETO
La presente Política de Privacidad tiene por objeto informar a los usuarios y clientes sobre la forma, condiciones y finalidades en que ${compName} (el "Responsable") efectúa el tratamiento de sus datos personales, en estricto cumplimiento y de conformidad con la Ley N° 21.719 (que regula la protección y tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales, APDP) y la Ley N° 19.628 sobre Protección de la Vida Privada de la República de Chile.

2. PRINCIPIOS APLICADOS AL TRATAMIENTO
En el tratamiento de sus datos personales, aplicamos de forma rigurosa los principios consagrados en el Artículo 3° de la Ley N° 21.719:
- Licitud y lealtad: Solo tratamos datos cuando contamos con una fuente legal de licitud o su consentimiento previo y explícito.
- Finalidad: Recopilamos sus datos exclusivamente para fines específicos, explícitos e informados.
- Proporcionalidad: Solo solicitamos los datos estrictamente necesarios y pertinentes.
- Calidad: Mantenemos los datos actualizados, exactos y completos.
- Seguridad: Implementamos medidas técnicas y organizativas para evitar filtraciones o pérdidas.
- Transparencia y confidencialidad: Garantizamos el deber de reserva y la información permanente.

3. DATOS RECOPILADOS Y SU FINALIDAD
A través de nuestros canales de contacto directos, formularios de contacto o de registro en el sitio web, recopilamos los siguientes datos personales:
- Identificación: Nombre completo.
- Contacto: Dirección de correo electrónico, teléfono de contacto.
Finalidades específicas: Responder solicitudes de contacto o soporte, enviar información comercial previamente autorizada, y gestionar la relación precontractual o contractual que nos vincule. No realizaremos tratamientos con finalidades distintas sin contar con su consentimiento explícito y separado.

4. DERECHOS DE LOS TITULARES (ARCOP)
Como titular de los datos, la Ley N° 21.719 le otorga derechos irrenunciables, los cuales puede ejercer de forma totalmente gratuita enviando una solicitud al correo electrónico: ${compEmail}:
- Acceso: Derecho a solicitar confirmación del tratamiento de sus datos y obtener copia estructurada.
- Rectificación: Derecho a modificar datos inexactos, desactualizados o incompletos.
- Supresión (Derecho al Olvido): Derecho a exigir la eliminación de sus datos cuando no exista fundamento legal para su conservación.
- Oposición: Derecho a oponerse a un tratamiento específico (como el marketing directo).
- Portabilidad: Derecho a solicitar que transmitamos sus datos a otro responsable en formato compatible.
- Bloqueo: Derecho a suspender el tratamiento de los datos temporalmente durante procesos de aclaración.

El Responsable dará respuesta a su requerimiento por escrito en un plazo máximo de treinta (30) días corridos desde la recepción de la solicitud.

5. CONSERVACIÓN Y SEGURIDAD DE LOS DATOS
De conformidad con el Artículo 3°, letra c (Principio de Proporcionalidad) de la Ley N° 21.719, sus datos personales se conservarán únicamente por el período de tiempo necesario para cumplir con los fines del tratamiento. Como período basal de retención para las consultas y datos recolectados a través de este sitio web, se establece un plazo máximo de conservación de 24 meses a contar de su recepción (o hasta que el titular revoque su consentimiento), plazo tras el cual procederemos a su eliminación definitiva o anonimización irreversible, cumpliendo así con lo exigido en el Artículo 14 ter, letra i de la ley. Hemos implementado medidas de encriptación y control de acceso necesarias bajo el principio de seguridad técnica. En caso de sufrir cualquier vulneración o incidente de seguridad que implique un riesgo para sus datos, notificaremos oportunamente a la Agencia de Protección de Datos Personales (APDP) y a los titulares afectados en un plazo máximo de 72 horas.

6. CONTACTO Y RECLAMOS
Para ejercer sus derechos o realizar cualquier consulta relacionada con esta Política de Privacidad, puede contactar al Responsable de Datos en:
- Domicilio Físico: ${compAddress}
- Correo electrónico: ${compEmail}

En caso de considerar que el tratamiento de sus datos infringe la legislación, tiene el derecho a interponer una reclamación formal ante la Agencia de Protección de Datos Personales (APDP).`;

        policyText.value = template;
        policyResultBox.classList.remove('hidden');
    });

    copyPolicyBtn.addEventListener('click', () => {
        policyText.select();
        document.execCommand('copy');
        copyPolicyBtn.innerHTML = '<i data-lucide="check"></i> Copiado';
        lucide.createIcons();
        setTimeout(() => {
            copyPolicyBtn.innerHTML = '<i data-lucide="copy"></i> Copiar';
            lucide.createIcons();
        }, 2000);
    });

    // 6. Cookie Consent Snippet Builder Logic
    const generateBannerBtn = document.getElementById('generate-banner-btn');
    const bannerResultBox = document.getElementById('banner-result-box');
    const bannerCode = document.getElementById('banner-code');
    const copyBannerBtn = document.getElementById('copy-banner-btn');

    generateBannerBtn.addEventListener('click', () => {
        const theme = document.getElementById('banner-theme').value;
        
        let bgStyle = 'background: #1e293b; color: #f8fafc; border: 1px solid rgba(255,255,255,0.08);';
        let btnPrimary = 'background: #06b6d4; color: #fff;';
        if (theme === 'light') {
            bgStyle = 'background: #f8fafc; color: #0f172a; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.15);';
            btnPrimary = 'background: #2563eb; color: #fff;';
        }

        const snippet = `<!-- BANNER DE CONSENTIMIENTO DE COOKIES - LEY 21.719 -->
<div id="apdp-cookie-banner" style="position: fixed; bottom: 20px; right: 20px; max-width: 420px; z-index: 99999; padding: 24px; border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.85rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); ${bgStyle} transition: transform 0.3s ease-in-out;">
    <div style="font-weight: 700; font-size: 1rem; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <span style="font-size:1.2rem;">🍪</span> Consentimiento de Privacidad
    </div>
    <p style="line-height: 1.4; margin-bottom: 15px; opacity: 0.9;">
        Conforme a la <strong>Ley N° 21.719 de Chile</strong>, requerimos tu consentimiento para instalar cookies no esenciales de analítica y marketing. Puedes configurar tus preferencias en cualquier momento.
    </p>
    
    <!-- Configuración Granular -->
    <div style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;">
        <label style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
            <input type="checkbox" id="cookie-ess" checked disabled style="accent-color: #06b6d4;"> Necesarias (Siempre activas)
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="cookie-ana" style="accent-color: #06b6d4;"> Analítica y Rendimiento
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="cookie-mkt" style="accent-color: #06b6d4;"> Publicidad y Marketing
        </label>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="cookie-btn-reject" style="background: transparent; border: 1px solid rgba(128,128,128,0.4); padding: 8px 14px; border-radius: 6px; cursor: pointer; color: inherit; font-weight: 600;">Rechazar todo</button>
        <button id="cookie-btn-accept" style="border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; ${btnPrimary}">Guardar y Aceptar</button>
    </div>
</div>

<script>
(function() {
    var banner = document.getElementById('apdp-cookie-banner');
    var acceptBtn = document.getElementById('cookie-btn-accept');
    var rejectBtn = document.getElementById('cookie-btn-reject');
    var anaCheckbox = document.getElementById('cookie-ana');
    var mktCheckbox = document.getElementById('cookie-mkt');

    // Check if consent has already been given
    var consent = localStorage.getItem('apdp-cookie-consent');
    if (consent) {
        banner.style.display = 'none';
        applyConsent(JSON.parse(consent));
    }

    acceptBtn.addEventListener('click', function() {
        var settings = {
            necessaries: true,
            analytics: anaCheckbox.checked,
            marketing: mktCheckbox.checked,
            timestamp: new Date().getTime()
        };
        localStorage.setItem('apdp-cookie-consent', JSON.stringify(settings));
        banner.style.display = 'none';
        applyConsent(settings);
    });

    rejectBtn.addEventListener('click', function() {
        var settings = {
            necessaries: true,
            analytics: false,
            marketing: false,
            timestamp: new Date().getTime()
        };
        localStorage.setItem('apdp-cookie-consent', JSON.stringify(settings));
        banner.style.display = 'none';
        applyConsent(settings);
    });

    function applyConsent(settings) {
        console.log('Aplicando consentimiento de cookies:', settings);
        if (settings.analytics) {
            // Cargar Google Analytics u otros scripts analíticos aquí
        }
        if (settings.marketing) {
            // Cargar Facebook Pixel u otros scripts publicitarios aquí
        }
    }
})();
</script>`;

        bannerCode.innerText = snippet;
        bannerResultBox.classList.remove('hidden');
    });

    copyBannerBtn.addEventListener('click', () => {
        // Use temporary textarea to copy formatted code
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = bannerCode.innerText;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        
        copyBannerBtn.innerHTML = '<i data-lucide="check"></i> Copiado';
        lucide.createIcons();
        setTimeout(() => {
            copyBannerBtn.innerHTML = '<i data-lucide="copy"></i> Copiar';
            lucide.createIcons();
        }, 2000);
    });
});
