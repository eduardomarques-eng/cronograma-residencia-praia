/**
 * ============================================================================
 * BRIEFING ARQVÉRTICE — ROTEIRO DA ENTREVISTA
 *
 * Este arquivo guarda APENAS os dados: a ficha de identificação e as perguntas.
 * Para incluir, remover ou reescrever uma pergunta, edite aqui — a tela, o
 * progresso, o JSON e o PDF se ajustam sozinhos. O motor vive em briefing.js.
 *
 * Tipos aceitos: 'longo' (textarea), 'texto', 'radio', 'checkbox' e 'cartoes'
 * (alternativas ilustradas). Qualquer pergunta aceita 'outro', que acrescenta
 * um campo livre ao lado das alternativas.
 * ============================================================================
 */

/** Identificacao preenchida na abertura da reuniao. */
const FICHA = [
  { id: 'cliente_nome',      rotulo: 'Nome do cliente',        icone: 'user',        tipo: 'texto', dica: 'Quem contrata o projeto' },
  { id: 'cliente_email',     rotulo: 'E-mail',                 icone: 'mail',        tipo: 'email' },
  { id: 'cliente_telefone',  rotulo: 'Telefone / WhatsApp',    icone: 'phone',       tipo: 'texto' },
  { id: 'projeto_tipo',      rotulo: 'Tipo de projeto',        icone: 'building-2',  tipo: 'texto', dica: 'Residencial, comercial, reforma...' },
  { id: 'projeto_local',     rotulo: 'Endereço / localização', icone: 'map-pin',     tipo: 'texto' },
  { id: 'briefing_data',     rotulo: 'Data da entrevista',     icone: 'calendar',    tipo: 'date' }
];

const ROTEIRO = [
  {
    parte: 'Parte 1',
    titulo: 'Entrevista aberta',
    subtitulo: 'Perguntas para o cliente falar à vontade. Anote com as palavras dele.',
    secoes: [
      {
        num: 1, id: 'perfil', tom: 'var(--c-perfil)', icone: 'users',
        titulo: 'Perfil dos Moradores ou Usuários',
        resumo: 'Entender a dinâmica de quem vai usar o espaço dita o fluxo do projeto.',
        perguntas: [
          { id: 'p1_quem', tipo: 'longo', texto: 'Quem vai habitar ou utilizar o espaço?', dica: 'Idade, profissão e hobbies de cada um.' },
          { id: 'p1_rotina', tipo: 'longo', texto: 'Como é a rotina da casa ou do comércio?', dica: 'Passam muito tempo fora? Trabalham em home office? Cozinham com frequência?' },
          { id: 'p1_visitas', tipo: 'longo', texto: 'Costumam receber visitas?', dica: 'Festas grandes, jantares íntimos, hóspedes que dormem no local?' },
          { id: 'p1_animais', tipo: 'longo', texto: 'Existem animais de estimação?', dica: 'Quais, portes e se precisam de espaços específicos.' },
          { id: 'p1_acessibilidade', tipo: 'longo', texto: 'Há alguma necessidade de acessibilidade ou cuidado especial?', dica: 'Idosos, cadeirantes, crianças pequenas.' }
        ]
      },
      {
        num: 2, id: 'terreno', tom: 'var(--c-terreno)', icone: 'map',
        titulo: 'O Terreno ou O Imóvel',
        resumo: 'Informações técnicas para iniciar a análise de viabilidade e as limitações do espaço.',
        perguntas: [
          { id: 'p2_natureza', tipo: 'radio', texto: 'O projeto é uma construção do zero, uma reforma completa ou uma intervenção de interiores?',
            opcoes: ['Construção do zero', 'Reforma completa', 'Intervenção de interiores'] },
          { id: 'p2_plantas', tipo: 'checkbox', texto: 'Você possui as plantas atuais do local?',
            dica: 'Marque o que já existe e pode ser enviado.',
            opcoes: ['Levantamento topográfico', 'Planta de arquitetura', 'Projeto estrutural', 'Projeto elétrico', 'Projeto hidrossanitário', 'Não possuo nenhuma planta'] },
          { id: 'p2_condominio', tipo: 'longo', texto: 'O local faz parte de um condomínio?', dica: 'Se sim, existem restrições de horário, dias de obra ou regras rigorosas de fachada?' },
          { id: 'p2_gosta', tipo: 'longo', texto: 'Quais as características que você mais gosta e menos gosta no terreno/imóvel atual?', dica: 'Ex.: "gosto da ventilação, odeio a falta de luz na sala".' }
        ]
      },
      {
        num: 3, id: 'programa', tom: 'var(--c-programa)', icone: 'layout-grid',
        titulo: 'Programa de Necessidades',
        resumo: 'A lista prática dos espaços e funções que o projeto precisa abrigar.',
        perguntas: [
          { id: 'p3_indispensaveis', tipo: 'longo', texto: 'Quais ambientes são indispensáveis para você?' },
          { id: 'p3_sonho', tipo: 'longo', texto: 'Existe algum espaço com uma função muito específica que você sonha em ter?', dica: 'Ex.: um espaço gourmet integrado, uma academia em casa, um estúdio, um quarto gamer.' },
          { id: 'p3_distribuicao', tipo: 'longo', texto: 'Como você prefere a distribuição dos ambientes?', dica: 'Conceito aberto com tudo integrado ou cômodos mais setorizados e privativos?' },
          { id: 'p3_armazenamento', tipo: 'longo', texto: 'Qual a sua necessidade de armazenamento?', dica: 'Muitas roupas, livros, equipamentos esportivos, louças volumosas?' }
        ]
      },
      {
        num: 4, id: 'estetica', tom: 'var(--c-estilo)', icone: 'palette',
        titulo: 'Estilo, Estética e Iluminação',
        resumo: 'O direcionamento visual para a modelagem 3D e a especificação de materiais.',
        perguntas: [
          { id: 'p4_estilos', tipo: 'longo', texto: 'Quais estilos de arquitetura ou decoração mais chamam a sua atenção?', dica: 'Minimalista, industrial, rústico, praiano/resort, contemporâneo?' },
          { id: 'p4_sensacoes', tipo: 'longo', texto: 'Quais sensações você quer que o ambiente transmita?', dica: 'Aconchego, energia, sofisticação, tranquilidade.' },
          { id: 'p4_materiais', tipo: 'longo', texto: 'Quais cores e materiais você ama e quais você detesta?', dica: 'Madeira, concreto aparente, pedras naturais, metais escuros.' },
          { id: 'p4_iluminacao', tipo: 'longo', texto: 'Como você prefere a iluminação dos ambientes?', dica: 'Gosta de luzes mais quentes e indiretas para relaxar, ou prefere ambientes muito claros e iluminados por igual?' },
          { id: 'p4_referencias', tipo: 'longo', texto: 'Você tem imagens de referência para compartilhar?', dica: 'Pinterest, Instagram — cole os links aqui.' }
        ]
      },
      {
        num: 5, id: 'orcamento', tom: 'var(--c-orcamento)', icone: 'wallet',
        titulo: 'Orçamento e Prazos',
        resumo: 'Alinhamento de realidade para que as especificações caibam no bolso do cliente.',
        perguntas: [
          { id: 'p5_investimento', tipo: 'longo', texto: 'Qual é a estimativa de investimento (teto máximo) para a execução da obra?' },
          { id: 'p5_prazo', tipo: 'longo', texto: 'Existe uma data limite ou prazo ideal para a finalização do projeto e entrega da obra?', dica: 'Ex.: nascimento de um filho, inauguração de uma loja.' }
        ]
      }
    ]
  },
  {
    parte: 'Parte 2',
    titulo: 'Questionário objetivo',
    subtitulo: 'As mesmas frentes, agora em alternativas — para fechar o escopo sem ambiguidade.',
    secoes: [
      {
        num: 6, id: 'uso', tom: 'var(--c-perfil)', icone: 'home',
        titulo: 'Perfil e Uso do Espaço',
        resumo: 'A natureza do uso define normas, fluxos e materiais.',
        perguntas: [
          { id: 'p6_uso', tipo: 'radio', texto: 'Qual é o uso principal do projeto?',
            opcoes: ['Residencial (Casa/Apartamento)', 'Comercial / Hospitalidade (Loja, Pousada, Restaurante)', 'Misto ou Outro'] },
          { id: 'p6_usuarios', tipo: 'longo', texto: 'Quem utilizará o espaço no dia a dia?',
            dica: 'Descreva brevemente quem são as pessoas, idades, ou o público-alvo, se for comercial.' },
          { id: 'p6_animais', tipo: 'radio', texto: 'Existem animais de estimação no local?',
            opcoes: ['Não', 'Sim, cachorro(s)', 'Sim, gato(s)'], outro: 'Outros' }
        ]
      },
      {
        num: 7, id: 'estilo', tom: 'var(--c-estilo)', icone: 'sparkles',
        titulo: 'Estilo e Estética',
        resumo: 'Direcionamento visual do projeto. Escolha pelas imagens.',
        perguntas: [
          { id: 'p7_estilos', tipo: 'cartoes', texto: 'Qual destes estilos arquitetônicos mais atrai você?', dica: 'Pode marcar mais de um.',
            cartoes: [
              { valor: 'Minimalista',        ilustracao: 'ilu-minimalista',   desc: 'Linhas limpas, essencial, sem excessos' },
              { valor: 'Rústico / Praiano',  ilustracao: 'ilu-rustico',       desc: 'Madeira, fibras naturais, estilo resort' },
              { valor: 'Industrial',         ilustracao: 'ilu-industrial',    desc: 'Cimento queimado, metais, tijolinhos, conduletes' },
              { valor: 'Contemporâneo',      ilustracao: 'ilu-contemporaneo', desc: 'Moderno, elegante, vidros, pedras' },
              { valor: 'Clássico',           ilustracao: 'ilu-classico',      desc: 'Molduras, lustres, acabamentos tradicionais' }
            ] },
          { id: 'p7_paleta', tipo: 'radio', texto: 'Qual a sua preferência geral para a paleta de cores e acabamentos?',
            opcoes: [
              'Tons neutros e claros (Branco, bege, cinza claro)',
              'Tons escuros e sóbrios (Preto, grafite, madeiras escuras)',
              'Base neutra com toques de cores vivas',
              'Texturas naturais (Muita madeira, linho, pedras)'
            ] },
          { id: 'p7_detesta', tipo: 'longo', texto: 'Existe algum material ou cor que você DETESTA e não quer ver no projeto de jeito nenhum?' }
        ]
      },
      {
        num: 8, id: 'layout', tom: 'var(--c-programa)', icone: 'layout-dashboard',
        titulo: 'Programa de Necessidades e Layout',
        resumo: 'Ambientes especiais e o grau de integração entre as áreas sociais.',
        perguntas: [
          { id: 'p8_ambientes', tipo: 'cartoes', texto: 'Você deseja incluir algum destes ambientes especiais no projeto?', dica: 'Pode marcar vários.',
            outro: 'Outro ambiente especial',
            cartoes: [
              { valor: 'Academia particular / Home Gym',    ilustracao: 'ilu-gym',     desc: 'Área de treino com equipamentos fixos' },
              { valor: 'Quarto Gamer / Estúdio de gravação', ilustracao: 'ilu-gamer',  desc: 'Tratamento acústico, cabeamento e iluminação cênica' },
              { valor: 'Home Office completo',              ilustracao: 'ilu-office',  desc: 'Estação de trabalho, marcenaria e luz de tarefa' },
              { valor: 'Espaço Gourmet / Churrasqueira',    ilustracao: 'ilu-gourmet', desc: 'Bancada, coifa, exaustão e apoio para receber' },
              { valor: 'Outro ambiente a definir',          ilustracao: 'ilu-outro',   desc: 'Descreva no campo abaixo' }
            ] },
          { id: 'p8_integracao', tipo: 'radio', texto: 'Como você prefere a integração dos ambientes sociais?',
            opcoes: [
              '100% Integrado (Cozinha, sala de estar e jantar em um espaço único)',
              'Parcialmente Integrado (Ex.: Cozinha fechada, mas salas unidas)',
              'Ambientes totalmente separados e privativos'
            ] },
          { id: 'p8_cozinha', tipo: 'longo', texto: 'O que não pode faltar de jeito nenhum na sua cozinha ou área molhada?',
            dica: 'Ex.: ilha central, cuba dupla, espaço para lava-louças de chão.' }
        ]
      },
      {
        num: 9, id: 'conforto', tom: 'var(--c-conforto)', icone: 'lightbulb',
        titulo: 'Iluminação e Conforto',
        resumo: 'Temperatura de luz e nível de automação definem o projeto elétrico.',
        perguntas: [
          { id: 'p9_luz', tipo: 'radio', texto: 'Como você prefere a iluminação principal dos ambientes de permanência (salas e quartos)?',
            opcoes: [
              'Quente e aconchegante (Amarelada, indireta, clima relaxante)',
              'Fria e clara (Branca, foco em máxima visibilidade)',
              'Mista (Luz clara para trabalho e limpeza, e luzes pontuais quentes para relaxar)'
            ] },
          { id: 'p9_automacao', tipo: 'radio', texto: 'Qual o nível de investimento em automação residencial você deseja?',
            opcoes: [
              'Nenhum, prefiro o sistema tradicional (interruptores padrão)',
              'Básico (Apenas controle de iluminação via Alexa/Google ou assistente virtual)',
              'Completo (Luzes, ar-condicionado, cortinas, fechaduras e câmeras)'
            ] }
        ]
      },
      {
        num: 10, id: 'investimento', tom: 'var(--c-orcamento)', icone: 'banknote',
        titulo: 'Investimento e Prazos',
        resumo: 'A faixa de investimento orienta cada especificação daqui para frente.',
        perguntas: [
          { id: 'p10_orcamento', tipo: 'radio', texto: 'Qual a estimativa de orçamento (teto) para a execução completa da obra/interiores?',
            opcoes: [
              'Até R$ 50.000',
              'De R$ 50.000 a R$ 150.000',
              'De R$ 150.000 a R$ 300.000',
              'Acima de R$ 300.000',
              'Ainda não tenho ideia, preciso da orientação do arquiteto'
            ] }
        ]
      }
    ]
  }
];
