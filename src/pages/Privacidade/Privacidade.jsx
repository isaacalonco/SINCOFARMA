import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Database,
  Scale,
  Share2,
  Clock,
  Lock,
  UserCheck,
  Monitor,
  ShieldCheck,
  Info,
} from "lucide-react";
import logo from "../../assets/logo-sincofarma.webp";
import SpotlightCard from "../../components/SpotlightCard";
import { useAuth } from "../../contexts/auth";
import { PRIVACIDADE } from "../../config/app";
import { rise } from "../../utils/motion";
import "../../styles/app.css";
import "./Privacidade.css";

const data = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

const SECTIONS = {
  controlador: { icon: Building2, hint: "Controlador e encarregado de dados." },
  dados: { icon: Database, hint: "O que fica registrado, de quem usa o painel e de pacientes.", wide: true },
  bases: { icon: Scale, hint: "Por que cada dado é tratado." },
  compartilhamento: { icon: Share2, hint: "Quem mais recebe os dados." },
  retencao: { icon: Clock, hint: "Prazos de guarda." },
  seguranca: { icon: Lock, hint: "Medidas técnicas e de acesso." },
  direitos: { icon: UserCheck, hint: "Como pedir acesso, cópia, correção ou exclusão.", wide: true },
  navegador: { icon: Monitor, hint: "O que o painel guarda no seu aparelho." },
};

function Section({ id, title, index, children }) {
  const { icon: Icon, hint, wide } = SECTIONS[id];
  return (
    <SpotlightCard index={index} id={id} className={`policy-card${wide ? " policy-card--wide" : ""}`}>
      <header className="policy-card-head">
        <span className="policy-card-icon"><Icon size={18} aria-hidden="true" /></span>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </header>
      {children}
    </SpotlightCard>
  );
}

/**
 * Política de privacidade do painel (LGPD, art. 9º): aberta sem login, linkada no
 * login e em "Minha conta". Mesmo visual das telas internas (fundo claro, trilha,
 * cartões). O texto acompanha o que o sistema faz de verdade; mudou o tratamento
 * (novo dado, novo compartilhamento, outro prazo)? Atualize aqui e a data.
 */
export default function Privacidade() {
  const { user } = useAuth();
  const { encarregado } = PRIVACIDADE;
  const back = user ? "/minha-conta" : "/login";

  return (
    <div className="dash policy-page">
      <div className="dash-main">
        <header className="topbar policy-topbar">
          <Link to={back}><img src={logo} alt="Sincofarma DF" className="policy-logo" /></Link>
          <Link to={back} className="btn btn--ghost policy-back">
            <ArrowLeft size={16} aria-hidden="true" /> {user ? "Voltar para minha conta" : "Voltar para o login"}
          </Link>
        </header>

        <main className="dash-content">
          <section className="page-head">
            <div>
              <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
                <b>SINCOFARMA</b>
                <span>/</span>
                <span>Privacidade</span>
              </motion.nav>
              <motion.h1 {...rise(1)}>Política de privacidade</motion.h1>
              <motion.p className="hello" {...rise(2)}>
                Como o painel clínico trata os seus dados, conforme a LGPD (Lei 13.709/2018).
              </motion.p>
            </div>
            <motion.span className="policy-updated" {...rise(2)}>Atualizada em {data(PRIVACIDADE.atualizadaEm)}</motion.span>
          </section>

          <motion.div className="policy-banner" role="note" {...rise(3)}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <b>Em resumo:</b> os dados não são vendidos nem usados para publicidade, ficam criptografados no Brasil
              e o painel não usa cookies de rastreamento.
            </span>
          </motion.div>

          <div className="policy-grid">
            <Section id="controlador" title="Quem cuida dos dados" index={4}>
              <p>
                O controlador é o <b>{PRIVACIDADE.controlador}</b>. Cada farmácia que usa o painel também
                responde pelos atendimentos que registra.
              </p>
              <div className="policy-callout">
                <b>Encarregado de dados (DPO)</b>
                <span>
                  {encarregado.nome ? (
                    <>
                      {encarregado.nome}
                      {encarregado.email && (
                        <> · <a href={`mailto:${encarregado.email}`}>{encarregado.email}</a></>
                      )}
                    </>
                  ) : (
                    "A ser nomeado pelo Sincofarma DF. Enquanto isso, fale com a farmácia ou com a administração do Sincofarma."
                  )}
                </span>
              </div>
            </Section>

            <Section id="dados" title="Que dados o painel guarda" index={5}>
              <div className="policy-split">
                <div className="policy-box">
                  <h3>De quem usa o painel</h3>
                  <small>Farmacêuticos, médicos e administração</small>
                  <ul>
                    <li>Nome, CPF (usado como login), e-mail, CRF e farmácia em que trabalha.</li>
                    <li>Senha (guardada só como código irreversível) e o app autenticador da verificação em duas etapas.</li>
                    <li>Aparelhos marcados como confiáveis por 24 horas.</li>
                    <li>O que fez no painel e quando: atendimentos registrados, fichas abertas, encaminhamentos, alterações.</li>
                    <li>Registros técnicos de acesso, com endereço IP.</li>
                  </ul>
                </div>
                <div className="policy-box">
                  <h3>De pacientes</h3>
                  <small>Atendidos nas farmácias</small>
                  <ul>
                    <li>Identificação: nome, CPF, Cartão Nacional de Saúde, data de nascimento, sexo e telefone.</li>
                    <li>
                      <b>Dados de saúde (sensíveis):</b> queixa, histórico (alergias, doenças, medicamentos), sinais
                      vitais, classificação de risco, sinais de alerta, observações e o desfecho do atendimento.
                    </li>
                    <li>Encaminhamentos a médicos, com o motivo e a resposta do médico.</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="bases" title="Para que e com qual base legal" index={6}>
              <dl className="policy-defs">
                <div>
                  <dt>Atendimento farmacêutico, triagem e encaminhamento</dt>
                  <dd>Tutela da saúde, por profissionais de saúde.</dd>
                  <dd className="policy-law">LGPD, art. 7º, VIII, e art. 11, II, f</dd>
                </div>
                <div>
                  <dt>Registro e guarda dos atendimentos e da responsabilidade técnica</dt>
                  <dd>Cumprimento de obrigação legal e regulatória.</dd>
                  <dd className="policy-law">art. 7º, II, e art. 11, II, a</dd>
                </div>
                <div>
                  <dt>Contas de acesso, segurança e auditoria</dt>
                  <dd>Execução do vínculo profissional e obrigação legal de segurança.</dd>
                  <dd className="policy-law">art. 7º, II e V, e art. 46</dd>
                </div>
              </dl>
            </Section>

            <Section id="compartilhamento" title="Com quem os dados são compartilhados" index={7}>
              <ul className="policy-rows">
                <li><b>Médicos cadastrados no painel</b><span>Só quando o farmacêutico encaminha o atendimento a eles.</span></li>
                <li>
                  <b>Amazon Web Services (São Paulo)</b>
                  <span>Hospedagem, banco de dados e login, com criptografia e chave própria do Sincofarma.</span>
                </li>
                <li><b>Vercel</b><span>Hospedagem das telas do painel; não guarda dados de pacientes.</span></li>
              </ul>
              <p className="policy-note"><Info size={15} aria-hidden="true" /> A integração com a RNDS (Ministério da Saúde) ainda não está ativa; quando estiver, esta página será atualizada.</p>
            </Section>

            <Section id="retencao" title="Por quanto tempo" index={8}>
              <ul className="policy-rows">
                <li><b>Atendimentos e encaminhamentos</b><span>Pelo prazo exigido pelas normas sanitárias e de saúde.</span></li>
                <li><b>Registro de quem fez o quê</b><span>Junto aos registros a que se refere.</span></li>
                <li><b>Registros técnicos de acesso (com IP)</b><span>90 dias.</span></li>
                <li><b>Conta de acesso</b><span>Enquanto durar o vínculo; depois, é anonimizada a pedido.</span></li>
              </ul>
            </Section>

            <Section id="seguranca" title="Como protegemos" index={9}>
              <ul className="policy-checks">
                <li>Login com senha forte e verificação em duas etapas obrigatória.</li>
                <li>Dados criptografados, com chave própria; sessões que encerram sozinhas por inatividade.</li>
                <li>Cada perfil vê só o necessário: a administração vê números, não listas de pacientes; o médico vê só o que foi encaminhado a ele.</li>
                <li>Toda abertura de ficha e toda alteração ficam registradas com quem fez e quando.</li>
              </ul>
            </Section>

            <Section id="direitos" title="Seus direitos (art. 18)" index={10}>
              <p>
                Você pode confirmar se tratamos seus dados, ter acesso a eles, corrigi-los, saber com quem foram
                compartilhados, receber uma cópia e pedir a eliminação quando a lei permitir.
              </p>
              <div className="policy-split">
                <div className="policy-box">
                  <h3>Se você usa o painel</h3>
                  <p>
                    Em <b>Minha conta → Privacidade e seus dados</b>: baixe um arquivo com tudo o que o painel guarda sobre
                    você e peça correção ou exclusão da conta. A exclusão anonimiza a conta; os atendimentos que você
                    registrou continuam guardados, como exige a norma sanitária.
                  </p>
                </div>
                <div className="policy-box">
                  <h3>Se você foi atendido numa farmácia</h3>
                  <p>
                    Peça na farmácia ou à administração do Sincofarma, com documento. Entregamos uma cópia de todos os seus
                    atendimentos e encaminhamentos, incluindo com quais médicos foram compartilhados. Dados de saúde não podem
                    ser apagados antes do prazo legal; correções são feitas pela farmácia que registrou o atendimento.
                  </p>
                </div>
              </div>
              <p className="policy-note"><Info size={15} aria-hidden="true" /> Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
            </Section>

            <Section id="navegador" title="Armazenamento no navegador" index={11}>
              <p>
                O painel não usa cookies de rastreamento nem de publicidade. Guarda no navegador só o necessário para
                funcionar: a sessão de login (apagada ao sair), a preferência de animações, o horário da última atividade
                (para encerrar por inatividade) e, se você marcar "confiar neste computador", a chave desse aparelho por 24 horas.
              </p>
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}
