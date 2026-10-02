export type BriefingQuestion = {
  id: string;
  type: "short" | "long" | "single" | "multiple" | "visual";
  text: string;
  hint?: string;
  options?: string[];
  visualOptions?: { value: string; title: string; description: string; imageUrl?: string | null; altText?: string | null }[];
};

export const briefingSections: { id: string; title: string; summary: string; questions: BriefingQuestion[] }[] = [
  {
    id: "perfil",
    title: "Perfil dos moradores ou usuários",
    summary: "Entender a dinâmica de quem vai usar o espaço.",
    questions: [
      { id: "p1_quem", type: "long", text: "Quem vai habitar ou utilizar o espaço?", hint: "Idade, profissão e hobbies de cada um." },
      { id: "p1_rotina", type: "long", text: "Como é a rotina da casa ou do comércio?", hint: "Home office, horários e hábitos." },
      { id: "p1_visitas", type: "long", text: "Costumam receber visitas?", hint: "Festas, jantares ou hóspedes." },
      { id: "p1_animais", type: "long", text: "Existem animais de estimação no local?" },
      { id: "p1_acessibilidade", type: "long", text: "Há alguma necessidade de acessibilidade ou cuidado especial?" },
    ],
  },
  {
    id: "terreno",
    title: "Terreno ou imóvel",
    summary: "Informações técnicas para iniciar a análise de viabilidade.",
    questions: [
      { id: "p2_natureza", type: "single", text: "O projeto é uma construção do zero, reforma ou intervenção?", options: ["Construção do zero", "Reforma completa", "Intervenção de interiores"] },
      { id: "p2_plantas", type: "multiple", text: "Você possui as plantas atuais do local?", options: ["Levantamento topográfico", "Planta de arquitetura", "Projeto estrutural", "Projeto elétrico", "Projeto hidrossanitário", "Não possuo nenhuma planta"] },
      { id: "p2_condominio", type: "long", text: "O local faz parte de um condomínio?" },
      { id: "p2_gosta", type: "long", text: "Quais características você mais gosta e menos gosta no imóvel?" },
    ],
  },
  {
    id: "programa",
    title: "Programa de necessidades",
    summary: "Os espaços e funções que o projeto precisa abrigar.",
    questions: [
      { id: "p3_indispensaveis", type: "long", text: "Quais ambientes são indispensáveis para você?" },
      { id: "p3_sonho", type: "long", text: "Existe algum espaço específico que você sonha em ter?" },
      { id: "p3_distribuicao", type: "long", text: "Como prefere a distribuição dos ambientes?" },
      { id: "p3_armazenamento", type: "long", text: "Qual é a sua necessidade de armazenamento?" },
    ],
  },
  {
    id: "estetica",
    title: "Estilo, estética e iluminação",
    summary: "Direcionamento visual para modelagem e materiais.",
    questions: [
      { id: "p4_estilos", type: "long", text: "Quais estilos de arquitetura ou decoração chamam sua atenção?" },
      { id: "p4_sensacoes", type: "long", text: "Quais sensações você quer que o ambiente transmita?" },
      { id: "p4_materiais", type: "long", text: "Quais cores e materiais você ama e quais detesta?" },
      { id: "p4_iluminacao", type: "long", text: "Como prefere a iluminação dos ambientes?" },
      { id: "p4_referencias", type: "long", text: "Você tem imagens de referência para compartilhar?", hint: "Cole links ou descreva as referências." },
    ],
  },
  {
    id: "objetivo",
    title: "Escolhas objetivas",
    summary: "Fechamento de escopo sem ambiguidade.",
    questions: [
      { id: "p6_uso", type: "single", text: "Qual é o uso principal do projeto?", options: ["Residencial (Casa/Apartamento)", "Comercial / Hospitalidade", "Misto ou Outro"] },
      { id: "p6_animais", type: "single", text: "Existem animais de estimação?", options: ["Não", "Sim, cachorro(s)", "Sim, gato(s)", "Outro", "Não sei / preciso de ajuda"] },
      { id: "p7_estilos", type: "visual", text: "Qual destes estilos arquitetônicos mais atrai você?", visualOptions: [
        { value: "Minimalista", title: "Minimalista", description: "Linhas limpas, essencial, sem excessos" },
        { value: "Rústico / Praiano", title: "Rústico / Praiano", description: "Madeira, fibras naturais, estilo resort" },
        { value: "Industrial", title: "Industrial", description: "Cimento queimado, metais e tijolinhos" },
        { value: "Contemporâneo", title: "Contemporâneo", description: "Moderno, elegante, vidros e pedras" },
        { value: "Clássico", title: "Clássico", description: "Molduras, lustres e acabamentos tradicionais" },
      ] },
      { id: "p8_ambientes", type: "visual", text: "Deseja incluir algum ambiente especial?", visualOptions: [
        { value: "Academia particular / Home Gym", title: "Home Gym", description: "Área de treino com equipamentos fixos" },
        { value: "Quarto Gamer / Estúdio de gravação", title: "Gamer ou estúdio", description: "Tratamento acústico, cabeamento e luz cênica" },
        { value: "Home Office completo", title: "Home office", description: "Estação de trabalho, marcenaria e luz de tarefa" },
        { value: "Espaço Gourmet / Churrasqueira", title: "Espaço gourmet", description: "Bancada, coifa e apoio para receber" },
      ] },
      { id: "p8_integracao", type: "single", text: "Como prefere a integração dos ambientes sociais?", options: ["100% integrado", "Parcialmente integrado", "Ambientes separados e privativos"] },
      { id: "p8_cozinha", type: "long", text: "O que não pode faltar na sua cozinha ou área molhada?" },
      { id: "p9_luz", type: "single", text: "Como prefere a iluminação principal?", options: ["Quente e aconchegante", "Fria e clara", "Mista"] },
      { id: "p9_automacao", type: "single", text: "Qual nível de investimento em automação deseja?", options: ["Nenhum", "Básico", "Completo", "Não sei / preciso de ajuda"] },
      { id: "p10_orcamento", type: "single", text: "Qual a estimativa de orçamento para a execução completa?", options: ["Até R$ 50.000", "De R$ 50.000 a R$ 150.000", "De R$ 150.000 a R$ 300.000", "Acima de R$ 300.000", "Ainda não tenho ideia, preciso de orientação"] },
    ],
  },
];

export const allBriefingQuestions = briefingSections.flatMap((section) => section.questions);
