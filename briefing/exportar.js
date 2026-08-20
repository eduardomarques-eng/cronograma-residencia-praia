/**
 * ============================================================================
 * BRIEFING ARQVÉRTICE — EXPORTAÇÕES
 *
 * Gera o briefing preenchido em PDF (folha branca, alto contraste) e em JSON.
 * Lê FICHA e ROTEIRO de roteiro.js e o estado de briefing.js.
 * ============================================================================
 */

function nomeArquivo(extensao) {
  // Remove as marcas de acento (U+0300 a U+036F) que o NFD separa da letra base.
  const cliente = (Respostas.cliente_nome || 'Cliente')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Briefing_ArqVertice_${cliente}_${new Date().toISOString().slice(0, 10)}.${extensao}`;
}

function exportarJSON() {
  const pacote = {
    escritorio: 'ArqVértice • Arquitetura, Estrutura & Engenharia',
    geradoEm: new Date().toISOString(),
    cliente: Object.fromEntries(FICHA.map(c => [c.id, Respostas[c.id] || ''])),
    observacoes: Respostas.cliente_observacoes || '',
    respostas: todasPerguntas().map(p => ({
      secao: p.secao,
      pergunta: p.texto,
      resposta: Respostas[p.id] ?? '',
      complemento: Respostas[p.id + '__outro'] || undefined
    }))
  };

  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo('json');
  a.click();
  URL.revokeObjectURL(url);
  avisar('Respostas exportadas em JSON.');
}

/** Monta o documento em folha branca e manda para o html2pdf. */
function montarDocumentoPDF() {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const fichaHTML = FICHA.map(c => `
    <div style="border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;">
      <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">${escapar(c.rotulo)}</div>
      <div style="font-size:11px;font-weight:700;color:#0f172a;">${escapar(Respostas[c.id] || '—')}</div>
    </div>
  `).join('');

  const secoesHTML = ROTEIRO.map(parte => `
    <div style="margin:16px 0 8px;padding:6px 10px;background:#0f172a;color:#fff;border-radius:5px;">
      <span style="font-size:9px;font-weight:800;letter-spacing:.08em;">${escapar(parte.parte.toUpperCase())} — ${escapar(parte.titulo.toUpperCase())}</span>
    </div>
    ${parte.secoes.map(s => `
      <div class="bloco-pdf" style="margin-bottom:12px;">
        <div style="font-size:11.5px;font-weight:900;color:#0f172a;border-left:4px solid #334155;padding-left:8px;margin-bottom:6px;">
          ${s.num}. ${escapar(s.titulo.toUpperCase())}
        </div>
        ${s.perguntas.map(p => {
          const v = Respostas[p.id];
          const extra = Respostas[p.id + '__outro'];
          let resp = Array.isArray(v) ? v.join(' · ') : (v || '');
          if (extra) resp = resp ? `${resp} · ${extra}` : extra;
          const vazia = !resp || !String(resp).trim();
          return `
            <div style="margin-bottom:7px;padding-bottom:6px;border-bottom:1px dotted #cbd5e1;">
              <div style="font-size:10px;font-weight:700;color:#334155;">${escapar(p.texto)}</div>
              <div style="font-size:11px;color:${vazia ? '#94a3b8' : '#0f172a'};font-style:${vazia ? 'italic' : 'normal'};white-space:pre-wrap;margin-top:2px;">
                ${vazia ? 'Não respondido' : escapar(resp)}
              </div>
            </div>`;
        }).join('')}
      </div>
    `).join('')}
  `).join('');

  return `
    <div style="font-family:Montserrat,Arial,sans-serif;color:#0f172a;background:#fff;padding:26px 30px;">

      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:58px;height:58px;border:2px solid #0f172a;border-radius:7px;padding:3px;">
            <img src="logo.png" style="width:100%;height:100%;object-fit:contain;">
          </div>
          <div>
            <div style="font-size:17px;font-weight:900;letter-spacing:-.02em;">BRIEFING DE PROJETO</div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#0f172a;">ArqVértice • Arquitetura, Estrutura &amp; Engenharia</div>
            <div style="font-size:9px;color:#475569;font-weight:600;">Entrevista guiada para definição de escopo, estilo e investimento.</div>
          </div>
        </div>
        <div style="text-align:right;font-size:9px;color:#334155;">
          <div><strong>Emissão:</strong> ${hoje}</div>
          <div><strong>Preenchido:</strong> ${document.getElementById('progresso-pct')?.textContent || '—'}</div>
        </div>
      </div>

      <div class="bloco-pdf" style="margin-bottom:14px;">
        <div style="font-size:11.5px;font-weight:900;border-left:4px solid #334155;padding-left:8px;margin-bottom:7px;">IDENTIFICAÇÃO DO CLIENTE</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">${fichaHTML}</div>
        <div style="margin-top:9px;border:1px solid #cbd5e1;border-left:5px solid #334155;border-radius:6px;padding:9px 11px;">
          <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Observações e pedidos do cliente</div>
          <div style="font-size:11px;white-space:pre-wrap;color:${Respostas.cliente_observacoes ? '#0f172a' : '#94a3b8'};font-style:${Respostas.cliente_observacoes ? 'normal' : 'italic'};">${escapar(Respostas.cliente_observacoes || 'Sem observações registradas.')}</div>
        </div>
      </div>

      ${secoesHTML}

      <div style="margin-top:18px;padding-top:10px;border-top:2px solid #0f172a;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:9px;color:#334155;">
        <div><strong style="color:#0f172a;">Eduardo Marques</strong><br>Arquiteto Projetista</div>
        <div><strong style="color:#0f172a;">Luan Almeida</strong><br>Engenheiro Calculista</div>
        <div><strong style="color:#0f172a;">Erick Santiago</strong><br>Engenheiro de Obra</div>
      </div>
    </div>
  `;
}

function exportarPDF() {
  const area = document.getElementById('area-pdf');
  if (!area) return;

  area.innerHTML = montarDocumentoPDF();
  avisar('Gerando o briefing em PDF...');

  const opcoes = {
    margin: [8, 8, 8, 8],
    filename: nomeArquivo('pdf'),
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    // Evita cortar uma seção no meio da virada de página.
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.bloco-pdf'] }
  };

  if (window.html2pdf) {
    html2pdf().set(opcoes).from(area).save()
      .then(() => avisar('Briefing em PDF gerado.'))
      .catch(err => {
        console.error('Falha ao gerar PDF:', err);
        avisar('Não foi possível gerar o PDF. Tente novamente.');
      });
  } else {
    window.print();
  }
}
