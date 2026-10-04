/**
 * FASE 4A — As etapas do briefing.
 *
 * Substitui as 5 secções que existiam. Os IDs das perguntas antigas foram
 * mantidos (`p1_quem`, `p2_plantas`, `p4_estilos`, ...) para que as respostas já
 * gravadas continuem a aparecer no sítio certo — mudar um ID aqui apagaria o
 * histórico do cliente sem que ninguém desse por isso.
 */
import { ANSWER_KIND } from "./briefing-schema";
import type { BriefingOption, BriefingQuestion, BriefingSection } from "./briefing-schema";

/** Percepções oferecidas como sugestão. NÃO é uma lista fechada. */
export const PERCEPTION_WORDS = [
  "Acolhedor",
  "Sofisticado",
  "Elegante",
  "Natural",
  "Contemporâneo",
  "Minimalista",
  "Aconchegante",
  "Imponente",
  "Leve",
  "Funcional",
  "Reservado",
  "Aberto",
  "Luminoso",
  "Intimista",
  "Tecnológico",
  "Artesanal",
] as const;

const MATERIALS: BriefingOption[] = [
  { value: "Madeira", label: "Madeira" },
  { value: "Pedra", label: "Pedra" },
  { value: "Concreto", label: "Concreto" },
  { value: "Ceramica", label: "Cerâmica" },
  { value: "Porcelanato", label: "Porcelanato" },
  { value: "Metais", label: "Metais" },
  { value: "Pintura", label: "Pintura" },
  { value: "Vidro", label: "Vidro" },
  { value: "Tecidos", label: "Tecidos" },
  { value: "Vegetacao", label: "Vegetação" },
];

const STYLES: BriefingOption[] = [
  { value: "Minimalista", label: "Minimalista" },
  { value: "Rustico", label: "Rústico / Praiano" },
  { value: "Industrial", label: "Industrial" },
  { value: "Contemporaneo", label: "Contemporâneo" },
  { value: "Classico", label: "Clássico" },
  { value: "Brutalista", label: "Brutalista" },
];

const AMBIENTES: BriefingOption[] = [
  { value: "Sala", label: "Sala" },
  { value: "Cozinha", label: "Cozinha" },
  { value: "Dormitorio", label: "Dormitório" },
  { value: "Banheiro", label: "Banheiro" },
  { value: "Home office", label: "Home office" },
  { value: "Varanda", label: "Varanda" },
];

/** Condição: existe um ambiente com este nome no programa de necessidades. */
function temAmbiente(nome: string) {
  return { questionId: "p3_ambientes", kind: "hasEnvironmentNamed" as const, value: nome };
}

const SLIDER = (min: number, max: number, left: string, right: string) => ({
  min,
  max,
  leftLabel: left,
  rightLabel: right,
});

export const briefingSections: BriefingSection[] = [
  {
    id: "cliente",
    step: 1,
    title: "Identificação do cliente",
    summary: "O cadastro já tem o essencial. Pedimos o que falta.",
    questions: [
      { id: "p1_nome_preferido", type: ANSWER_KIND.SHORT_TEXT, text: "Como prefere ser chamado?", placeholder: "Ex.: Dr., Dona, apelido" },
      { id: "p1_profissao", type: ANSWER_KIND.SHORT_TEXT, text: "Profissão ou atividade principal", placeholder: "Ex.: médico, professor" },
      { id: "p1_cidade", type: ANSWER_KIND.SHORT_TEXT, text: "Cidade onde mora ou atua" },
      {
        id: "p1_relacao",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Qual é a sua relação com o imóvel?",
        required: true,
        options: [
          { value: "OWNER", label: "Proprietário" },
          { value: "BUYER", label: "Comprador" },
          { value: "TENANT", label: "Locatário" },
          { value: "INVESTOR", label: "Investidor" },
          { value: "OTHER", label: "Outro" },
        ],
      },
      { id: "p1_contato_extra", type: ANSWER_KIND.PHONE, text: "Telefone ou WhatsApp para contacto durante o projeto", hint: "Opcional. Só se o telefone do cadastro não for o melhor canal." },
    ],
  },
  {
    id: "usuarios",
    step: 2,
    title: "Perfil dos usuários",
    summary: "O projeto não é só do contratante: quem mais vai usar o espaço.",
    questions: [
      {
        id: "p1_quem",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Quem vai utilizar o espaço?",
        hint: "Um registo por pessoa: nome, faixa etária, relação, quantidade, se trabalha em casa e rotinas relevantes.",
        required: true,
      },
      {
        id: "p1_animais",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "Existem animais no local?",
        options: [
          { value: "cachorro", label: "Cachorro" },
          { value: "gato", label: "Gato" },
          { value: "outro", label: "Outro" },
          { value: "nao", label: "Não" },
        ],
      },
      {
        id: "p1_animais_detalhe",
        type: ANSWER_KIND.LONG_TEXT,
        text: "O que é preciso ter em conta por causa dos animais?",
        hint: "Ex.: rotina de passeio, comedouro, área de descanso.",
        showIf: [{ questionId: "p1_animais", kind: "includes", value: "cachorro" }],
      },
      { id: "p1_acessibilidade", type: ANSWER_KIND.LONG_TEXT, text: "Há alguma necessidade de acessibilidade ou cuidado especial?", hint: "Ex.: pessoa idosa, criança pequena." },
      { id: "p1_visitas", type: ANSWER_KIND.LONG_TEXT, text: "Costumam receber visitas? Com que frequência?", hint: "Ex.: jantares, festas, hóspedes frequentes." },
    ],
  },
  {
    id: "contexto",
    step: 3,
    title: "Contexto e objetivos",
    summary: "Por que este projeto agora, e o que tem de mudar.",
    questions: [
      { id: "p3_porque_agora", type: ANSWER_KIND.LONG_TEXT, text: "Por que decidiu realizar este projeto agora?", required: true },
      { id: "p3_problema", type: ANSWER_KIND.LONG_TEXT, text: "O que mais incomoda hoje no espaço?", required: true },
      { id: "p3_mudar", type: ANSWER_KIND.LONG_TEXT, text: "O que espera mudar depois do projeto?" },
      {
        id: "p3_prioridade_objetivo",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Qual é o principal objetivo deste projeto?",
        required: true,
        options: [
          { value: "essencial", label: "Essencial: sem isto o projeto não faz sentido" },
          { value: "importante", label: "Importante: faz diferença real" },
          { value: "desejavel", label: "Desejável: seria um bônus" },
          { value: "opcional", label: "Opcional: se sobrar espaço" },
        ],
      },
      { id: "p3_nao_quero", type: ANSWER_KIND.LONG_TEXT, text: "Existe algo que você definitivamente não quer?", hint: "Responda mesmo que pareça óbvio: é o que evita erro na proposta." },
      { id: "p3_dia_a_dia", type: ANSWER_KIND.LONG_TEXT, text: "Como você gostaria que o espaço funcionasse no dia a dia?" },
    ],
  },
  {
    id: "imovel",
    step: 4,
    title: "Dados do imóvel",
    summary: "O que já existe e o que está em bom estado.",
    questions: [
      {
        id: "p2_natureza",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "O projeto é uma construção do zero, reforma ou intervenção?",
        required: true,
        options: [
          { value: "Construção do zero", label: "Construção do zero" },
          { value: "Reforma completa", label: "Reforma completa" },
          { value: "Intervenção de interiores", label: "Intervenção de interiores" },
        ],
      },
      { id: "p4_area_construida", type: ANSWER_KIND.NUMBER, text: "Área construída aproximada, em m²", hint: "Se não souber, deixe vazio e detalhe na observação." },
      { id: "p4_area_terreno", type: ANSWER_KIND.NUMBER, text: "Área do terreno, em m²" },
      { id: "p4_idade_imovel", type: ANSWER_KIND.NUMBER, text: "Quantos anos tem o imóvel?" },
      { id: "p4_pavimento", type: ANSWER_KIND.SHORT_TEXT, text: "Quantos pavimentos e qual é o seu?" },
      {
        id: "p4_itens_manter",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Itens existentes que devem permanecer",
        hint: "Mobiliário, eletrodomésticos, revestimentos, ar condicionado, peças de valor. Para cada um: manter, mover, restaurar ou substituir.",
      },
      { id: "p2_gosta", type: ANSWER_KIND.LONG_TEXT, text: "Quais características você mais gosta no imóvel hoje?" },
      { id: "p2_nao_gosta", type: ANSWER_KIND.LONG_TEXT, text: "E o que menos gosta?" },
    ],
  },
  {
    id: "localizacao",
    step: 5,
    title: "Localização",
    summary: "Onde o imóvel está e o que a vizinhança impõe.",
    questions: [
      { id: "p5_endereco", type: ANSWER_KIND.SHORT_TEXT, text: "Endereço do imóvel" },
      { id: "p5_topografia", type: ANSWER_KIND.SHORT_TEXT, text: "Como é o terreno?", hint: "Ex.: plano, inclinado, morro, beira de praia." },
      { id: "p5_acesso", type: ANSWER_KIND.LONG_TEXT, text: "Como é o acesso e o espaço de circulação externo?", hint: "Ex.: rua estreita, portão, subsolo, condição do vizinho." },
      { id: "p2_condominio", type: ANSWER_KIND.LONG_TEXT, text: "O local faz parte de um condomínio? Quais as regras relevantes?" },
    ],
  },
  {
    id: "programa",
    step: 6,
    title: "Programa de necessidades",
    summary: "O programa estruturado é a base da Fase 4B: cada ambiente vira um registo.",
    questions: [
      {
        id: "p3_ambientes",
        type: ANSWER_KIND.ENVIRONMENT_GROUP,
        text: "Quais ambientes o projeto precisa ter?",
        required: true,
        hint: "Um cartão por ambiente: nome, quantidade, prioridade, área aproximada, usuários, função e requisitos.",
      },
      {
        id: "p3_indispensaveis",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "Quais destes são indispensáveis?",
        hint: "Marque os que não podem faltar, mesmo que o espaço seja apertado.",
        options: AMBIENTES,
        showIf: [{ questionId: "p3_ambientes", kind: "answered" }],
      },
      { id: "p3_sonho", type: ANSWER_KIND.LONG_TEXT, text: "Existe algum ambiente específico que você sonha em ter?", showIf: [{ questionId: "p3_ambientes", kind: "answered" }] },
      { id: "p3_distribuicao", type: ANSWER_KIND.LONG_TEXT, text: "Como prefere a distribuição dos ambientes?" },
      { id: "p3_armazenamento", type: ANSWER_KIND.LONG_TEXT, text: "Qual é a sua necessidade de armazenamento?" },
      {
        id: "p3_relacoes",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Como estes ambientes devem relacionar-se?",
        hint: "Par a par: integração desejada, proximidade ou separação, prioridade.",
        showIf: [{ questionId: "p3_ambientes", kind: "answered" }],
      },
    ],
  },
  {
    id: "ambientes",
    step: 7,
    title: "Atributos dos ambientes",
    summary: "Cada ambiente tem exigências próprias. Abrimos só o que interessa.",
    questions: [
      { id: "p7_sala_tv", type: ANSWER_KIND.BOOLEAN, text: "Na sala, haverá TV?", showIf: [temAmbiente("Sala")] },
      { id: "p7_sala_receber", type: ANSWER_KIND.NUMBER, text: "Quantas pessoas a sala recebe sentadas?", showIf: [temAmbiente("Sala")] },
      { id: "p7_sala_indireta", type: ANSWER_KIND.BOOLEAN, text: "Na sala, quer iluminação indireta?", showIf: [temAmbiente("Sala")] },
      {
        id: "p7_cozinha_conceito",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Cozinha aberta ou fechada?",
        options: [
          { value: "Aberta", label: "Aberta, integrada à sala" },
          { value: "Parcial", label: "Parcialmente integrada" },
          { value: "Fechada", label: "Fechada, separada" },
        ],
        showIf: [temAmbiente("Cozinha")],
      },
      { id: "p7_home_office", type: ANSWER_KIND.NUMBER, text: "Quantas pessoas trabalham em casa?", hint: "0 se ninguém trabalha em casa.", showIf: [temAmbiente("Home office")] },
      { id: "p7_home_office_video", type: ANSWER_KIND.BOOLEAN, text: "Há videoconferência no home office?", showIf: [{ questionId: "p7_home_office", kind: "answered" }] },
      { id: "p7_banheiro_acessivel", type: ANSWER_KIND.BOOLEAN, text: "Algum banheiro precisa ser acessível?", showIf: [temAmbiente("Banheiro")] },
    ],
  },
  {
    id: "rotina",
    step: 8,
    title: "Rotina e uso",
    summary: "Como os espaços são realmente usados, não como deveriam ser.",
    questions: [
      { id: "p1_rotina", type: ANSWER_KIND.LONG_TEXT, text: "Como é a rotina da casa ou do comércio?", hint: "Manhã, noite, fim de semana, trabalho em casa, hóspedes." },
      { id: "p8_manha", type: ANSWER_KIND.LONG_TEXT, text: "Como começa a rotina pela manhã?" },
      {
        id: "p8_mais_usados",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "Quais ambientes são mais utilizados?",
        options: [
          { value: "Área social", label: "Área social" },
          { value: "Cozinha", label: "Cozinha" },
          { value: "Quartos", label: "Quartos" },
          { value: "Trabalho", label: "Escritório ou home office" },
          { value: "Área externa", label: "Área externa" },
        ],
      },
      { id: "p8_simultaneo", type: ANSWER_KIND.LONG_TEXT, text: "Que ambientes precisam funcionar ao mesmo tempo?" },
      { id: "p8_desconforto", type: ANSWER_KIND.LONG_TEXT, text: "Existe alguma rotina que hoje gera desconforto?" },
      { id: "p8_servico", type: ANSWER_KIND.BOOLEAN, text: "Há necessidade de entrada de serviço independente?", hint: "Ex.: entregas, resíduos, funcionários de serviço." },
    ],
  },
  {
    id: "estilo",
    step: 9,
    title: "Estilo e identidade",
    summary: "O que o espaço deve parecer, e o que não pode parecer.",
    questions: [
      { id: "p4_estilos", type: ANSWER_KIND.LONG_TEXT, text: "Quais estilos de arquitetura ou decoração chamam sua atenção?", hint: "Descreva à vontade: a lista abaixo é apenas uma sugestão." },
      { id: "p9_estilos_gosta", type: ANSWER_KIND.MULTI_SELECT, text: "Estilos que você GOSTA", hint: "Pode escolher vários.", options: STYLES },
      { id: "p9_estilos_nao_gosta", type: ANSWER_KIND.MULTI_SELECT, text: "Estilos que você NÃO quer", options: STYLES },
      {
        id: "p7_estilos",
        type: ANSWER_KIND.IMAGE_CHOICE,
        text: "Qual destes estilos arquitetônicos mais atrai você?",
        hint: "Escolha uma ou mais. Se nenhuma for exata, escreva nas observações.",
        visualOptions: [
          { value: "Minimalista", label: "Minimalista", description: "Linhas limpas, essencial, sem excessos" },
          { value: "Rústico / Praiano", label: "Rústico / Praiano", description: "Madeira, fibras naturais, estilo resort" },
          { value: "Industrial", label: "Industrial", description: "Cimento queimado, metais e tijolinhos" },
          { value: "Contemporâneo", label: "Contemporâneo", description: "Moderno, elegante, vidros e pedras" },
          { value: "Clássico", label: "Clássico", description: "Molduras, lustres e acabamentos tradicionais" },
        ],
      },
      {
        id: "p8_ambientes",
        type: ANSWER_KIND.IMAGE_CHOICE,
        text: "Deseja incluir algum ambiente especial?",
        hint: "Escolha os que despertam interesse, mesmo que ainda não sean obrigatórios.",
        visualOptions: [
          { value: "Home Gym", label: "Home Gym", description: "Área de treino com equipamentos fixos" },
          { value: "Gamer", label: "Gamer ou estúdio", description: "Tratamento acústico, cabeamento e luz cênica" },
          { value: "Home office", label: "Home office", description: "Estação de trabalho, marcenaria e luz de tarefa" },
          { value: "Espaço gourmet", label: "Espaço gourmet", description: "Bancada, coifa e apoio para receber" },
        ],
      },
      { id: "p4_cores", type: ANSWER_KIND.LONG_TEXT, text: "Que cores você ama e quais evita?" },
      { id: "p4_texturas", type: ANSWER_KIND.LONG_TEXT, text: "Que texturas e formas lhe agradam?" },
      { id: "p4_vegetacao", type: ANSWER_KIND.BOOLEAN, text: "Pretende incluir vegetação no projeto?" },
    ],
  },
  {
    id: "referencias",
    step: 10,
    title: "Referências visuais",
    summary: "Uma imagem vale mais que uma descrição, e é preciso saber o que nela agradou.",
    questions: [
      {
        id: "p4_referencias",
        type: ANSWER_KIND.IMAGE_UPLOAD,
        text: "Envie imagens de referência",
        hint: "Fachada, cozinha, sala, iluminação, materiais. Para cada uma diga o que gosta e o que não gosta.",
        referenceCategory: "REFERENCIA",
      },
      { id: "p10_links", type: ANSWER_KIND.LONG_TEXT, text: "Tem outras referências por link ou descrição?", hint: "Links são aceites; a descrição ajuda mais do que o link." },
    ],
  },
  {
    id: "percepcao",
    step: 11,
    title: "Percepção e experiência",
    summary: "Como o espaço deve fazer sentir. Orienta o projeto; não decide nada sozinho.",
    questions: [
      {
        id: "p4_sensacoes",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "Que sensação o ambiente deve transmitir?",
        hint: "Pode escolher quantas quiser.",
        options: PERCEPTION_WORDS.map((word) => ({ value: word, label: word })),
      },
      {
        id: "p11_outra_palavra",
        type: ANSWER_KIND.SHORT_TEXT,
        text: "Existe alguma palavra que descreva exatamente o que você quer e que não esteja na lista?",
        hint: "Este campo é tão importante quanto a lista.",
      },
      { id: "p11_scaling", type: ANSWER_KIND.SLIDER, text: "Como prefere o equilíbrio do espaço?", hint: "Arraste. Os extremos estão descritos em baixo.", scale: SLIDER(-5, 5, "Mais aberto", "Mais reservado") },
      { id: "p11_scaling_2", type: ANSWER_KIND.SLIDER, text: "Como prefere a temperatura visual?", scale: SLIDER(-5, 5, "Mais frio", "Mais acolhedor") },
      { id: "p11_scaling_3", type: ANSWER_KIND.SLIDER, text: "Quanto prefere a integração dos ambientes?", scale: SLIDER(-5, 5, "Mais separado", "Mais integrado") },
      { id: "p11_scaling_4", type: ANSWER_KIND.SLIDER, text: "Quanto prefere luz natural?", scale: SLIDER(-5, 5, "Menos luz natural", "Mais luz natural") },
      { id: "p11_refugio", type: ANSWER_KIND.LONG_TEXT, text: "Onde precisa de um lugar de refúgio: silêncio, descanso, concentração?" },
    ],
  },
  {
    id: "materiais",
    step: 12,
    title: "Materiais e preferências",
    summary: "O que aceita, o que recusa, o que quer manter e o que quer experimentar.",
    questions: [
      { id: "p12_gosta", type: ANSWER_KIND.MULTI_SELECT, text: "Quais materiais você gosta?", options: MATERIALS },
      { id: "p12_nao_quero", type: ANSWER_KIND.MULTI_SELECT, text: "Quais materiais não quer utilizar?", options: MATERIALS },
      { id: "p12_manter", type: ANSWER_KIND.LONG_TEXT, text: "Existe algum material que deseja manter?" },
      { id: "p12_experimentar", type: ANSWER_KIND.LONG_TEXT, text: "Existe algum material que gostaria de experimentar?" },
      { id: "p12_outro", type: ANSWER_KIND.SHORT_TEXT, text: "Outro material a considerar", hint: "Campo livre: a lista acima é sugestão, não limite." },
    ],
  },
  {
    id: "conforto",
    step: 13,
    title: "Iluminação e conforto",
    summary: "Luz, som, temperatura e manutenção. Preferências, não é projeto luminotécnico.",
    questions: [
      {
        id: "p14_luz_natural",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Como prefere aproveitar a luz natural?",
        options: [
          { value: "Muita luz natural", label: "Muita luz natural" },
          { value: "Luz natural controlada", label: "Luz natural controlada" },
          { value: "Independente da luz natural", label: "Independente da luz natural" },
        ],
      },
      {
        id: "p9_luz",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Como prefere a iluminação principal?",
        options: [
          { value: "Quente e aconchegante", label: "Quente e aconchegante" },
          { value: "Fria e clara", label: "Fria e clara" },
          { value: "Mista", label: "Mista" },
        ],
      },
      { id: "p14_indireta", type: ANSWER_KIND.BOOLEAN, text: "Gosta de iluminação indireta?" },
      { id: "p14_cenica", type: ANSWER_KIND.BOOLEAN, text: "Quer iluminação cênica ou de destaque?" },
      {
        id: "p9_automacao",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Qual nível de automação deseja?",
        options: [
          { value: "Nenhum", label: "Nenhum" },
          { value: "Básico", label: "Básico" },
          { value: "Completo", label: "Completo" },
          { value: "Não sei", label: "Não sei, preciso de orientação" },
        ],
      },
      { id: "p14_acustica", type: ANSWER_KIND.LONG_TEXT, text: "Alguma preocupação com acústica ou ruído?" },
      { id: "p14_ventilacao", type: ANSWER_KIND.LONG_TEXT, text: "Alguma preocupação com ventilação ou temperatura?" },
      { id: "p14_sol", type: ANSWER_KIND.BOOLEAN, text: "Precisa de controlo da incidência solar direta?" },
      {
        id: "p14_limpeza",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "O que facilita a limpeza?",
        options: [
          { value: "Superfícies contínuas", label: "Superfícies contínuas" },
          { value: "Poucos materiais", label: "Poucos materiais" },
          { value: "Revestimentos de fácil limpeza", label: "Revestimentos de fácil limpeza" },
          { value: "Sem preocupação", label: "Sem preocupação com isso" },
        ],
      },
      { id: "p14_privacidade", type: ANSWER_KIND.LONG_TEXT, text: "Alguma exigência de privacidade entre ambientes?" },
    ],
  },
  {
    id: "tecnico",
    step: 14,
    title: "Necessidades técnicas",
    summary: "O que já existe e o que pretende mudar. Sem solução prometida.",
    questions: [
      {
        id: "p15_tecnicas",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Instalações e sistemas",
        hint: "Elétrica, hidráulica, sanitária, climatização, automação, gás, estrutura, esquadrias, fachada, cobertura, impermeabilização, segurança. Para cada um: necessário, existente, quer alterar.",
        required: true,
      },
      {
        id: "p2_plantas",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "Quais documentos técnicos possui?",
        options: [
          { value: "Levantamento topográfico", label: "Levantamento topográfico" },
          { value: "Planta de arquitetura", label: "Planta de arquitetura" },
          { value: "Projeto estrutural", label: "Projeto estrutural" },
          { value: "Projeto elétrico", label: "Projeto elétrico" },
          { value: "Projeto hidrossanitário", label: "Projeto hidrossanitário" },
          { value: "Nenhum", label: "Não possuo nenhuma planta" },
        ],
      },
    ],
  },
  {
    id: "acessibilidade",
    step: 15,
    title: "Acessibilidade e restrições",
    summary: "O que a lei, o condomínio ou a família impõem.",
    questions: [
      { id: "p16_mobilidade", type: ANSWER_KIND.BOOLEAN, text: "Existe algum usuário com mobilidade reduzida?" },
      {
        id: "p16_requisitos",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Requisitos de acessibilidade",
        hint: "Circulação, banheiro adaptado, barras, ausência de degraus, largura de portas.",
        showIf: [{ questionId: "p16_mobilidade", kind: "equals", value: "true" }],
      },
      {
        id: "p16_restricoes",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Restrições conhecidas",
        hint: "Condomínio, legislação, orçamento, estrutura existente, imóvel alugado, prazo, materiais proibidos, patrimônio.",
      },
    ],
  },
  {
    id: "orcamento",
    step: 16,
    title: "Orçamento e prioridades",
    summary: "Levantamento. Não vira preço de proposta: a Fase 4C trata disso.",
    questions: [
      { id: "p10_orcamento", type: ANSWER_KIND.MONEY, text: "Orçamento estimado para a execução, em reais", hint: "Se ainda não tiver ideia, preencha a faixa abaixo." },
      {
        id: "p17_faixa",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Qual a faixa de investimento considerada?",
        options: [
          { value: "Até R$ 50.000", label: "Até R$ 50.000" },
          { value: "De R$ 50.000 a R$ 150.000", label: "De R$ 50.000 a R$ 150.000" },
          { value: "De R$ 150.000 a R$ 300.000", label: "De R$ 150.000 a R$ 300.000" },
          { value: "Acima de R$ 300.000", label: "Acima de R$ 300.000" },
          { value: "Ainda não tenho ideia", label: "Ainda não tenho ideia, preciso de orientação" },
        ],
      },
      {
        id: "p17_prioridade_itens",
        type: ANSWER_KIND.REPEAT_GROUP,
        text: "Itens por prioridade",
        hint: "Classifique cada item como essencial, importante, desejável ou adiável.",
        showIf: [{ questionId: "p3_ambientes", kind: "answered" }],
      },
    ],
  },
  {
    id: "prazo",
    step: 17,
    title: "Prazo e expectativas",
    summary: "Quando precisa, porquê, e quão rígido é.",
    questions: [
      { id: "p18_tem_prazo", type: ANSWER_KIND.BOOLEAN, text: "Existe uma data desejada?" },
      { id: "p18_data", type: ANSWER_KIND.DATE, text: "Qual a data desejada?", showIf: [{ questionId: "p18_tem_prazo", kind: "equals", value: "true" }] },
      { id: "p18_motivo", type: ANSWER_KIND.SHORT_TEXT, text: "Qual o motivo da data?", hint: "Mudança, evento, data de obra, contrato.", showIf: [{ questionId: "p18_tem_prazo", kind: "equals", value: "true" }] },
      {
        id: "p18_flexibilidade",
        type: ANSWER_KIND.SINGLE_SELECT,
        text: "Quão flexível é esse prazo?",
        options: [
          { value: "Rígido", label: "Rígido: não posso mudar" },
          { value: "Alguma flexibilidade", label: "Alguma flexibilidade" },
          { value: "Totalmente flexível", label: "Totalmente flexível" },
        ],
      },
      { id: "p18_prazo_obra", type: ANSWER_KIND.LONG_TEXT, text: "Existe prazo de obra em andamento?" },
      { id: "p18_prazo_projeto", type: ANSWER_KIND.LONG_TEXT, text: "Existe prazo para a entrega do projeto?" },
      { id: "p18_evento", type: ANSWER_KIND.SHORT_TEXT, text: "Existe algum evento específico no horizonte?", hint: "Ex.: mudança de casa, casamento, abertura de negócio." },
    ],
  },
  {
    id: "servicos",
    step: 18,
    title: "Serviços pretendidos",
    summary: "Intenção declarada. A Fase 4C transforma isto em proposta, com preço.",
    questions: [
      {
        id: "p19_servicos",
        type: ANSWER_KIND.MULTI_SELECT,
        text: "Que serviços pretende contratar?",
        required: true,
        options: [
          { value: "ARQUITETURA", label: "Arquitetura" },
          { value: "ESTRUTURAL", label: "Projeto estrutural" },
          { value: "INTERIORES", label: "Interiores" },
          { value: "3D_RENDER", label: "3D e render" },
          { value: "COMPLEMENTARES", label: "Complementares: elétrico e hidrossanitário" },
        ],
      },
      { id: "p19_outros", type: ANSWER_KIND.SHORT_TEXT, text: "Outro serviço pretendido", hint: "Campo livre: a lista acima é sugestão." },
      { id: "p19_decidir", type: ANSWER_KIND.LONG_TEXT, text: "O que precisa decidir sobre estes serviços antes de avançar?", hint: "Ex.: consultar alguém, pedir orçamento a terceiros, decidir internamente." },
    ],
  },
  {
    id: "documentos",
    step: 19,
    title: "Documentos e arquivos",
    summary: "Planta, levantamento, escritura, fotos, medições. O que existe e o que falta.",
    questions: [
      { id: "p20_arquivos", type: ANSWER_KIND.FILE, text: "Envie plantas, levantamentos e documentos do imóvel", referenceCategory: "DOCUMENTO" },
      { id: "p20_fotos", type: ANSWER_KIND.IMAGE_UPLOAD, text: "Envie fotografias do imóvel", hint: "Uma foto por ambiente ajuda mais que dez fotos do mesmo lugar.", referenceCategory: "FOTO_IMOVEL" },
      { id: "p20_faltando", type: ANSWER_KIND.LONG_TEXT, text: "Que documentos está à espera de obter?", hint: "Isto vira pendência na consolidação." },
    ],
  },
  {
    id: "observacoes",
    step: 20,
    title: "Observações livres",
    summary: "Qualquer coisa que não caiba nas perguntas anteriores.",
    questions: [
      { id: "p21_observacoes", type: ANSWER_KIND.LONG_TEXT, text: "Há algo que não perguntámos e que devíamos saber?", hint: "Por escrito ou por áudio, o que preferir." },
      { id: "p21_observacoes_audio", type: ANSWER_KIND.AUDIO, text: "Ou diga por aqui", hint: "Grava se preferir falar." },
    ],
  },
  {
    id: "revisao",
    step: 21,
    title: "Revisão e confirmação",
    summary: "Uma leitura de tudo antes de enviar, para o estúdio trabalhar com dados fiáveis.",
    questions: [],
  },
];

export const allBriefingQuestions: BriefingQuestion[] = briefingSections.flatMap(
  (section) => section.questions,
);

export const briefingQuestionById = new Map(
  allBriefingQuestions.map((question) => [question.id, question]),
);