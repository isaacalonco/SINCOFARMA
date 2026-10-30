import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logo from "../../assets/logo-sincofarma.webp";
import { useAuth } from "../../contexts/auth";
import { PRIVACIDADE } from "../../config/app";
import "./Privacidade.css";

const data = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Política de privacidade do painel (LGPD, art. 9º): aberta sem login, linkada no
 * login e em "Minha conta". O texto acompanha o que o sistema faz de verdade; mudou
 * o tratamento (novo dado, novo compartilhamento, outro prazo)? Atualize aqui e a data.
 */
export default function Privacidade() {
  const { user } = useAuth();
  const { encarregado } = PRIVACIDADE;

  return (
    <div className="policy-page">
      <header className="policy-header">
        <img src={logo} alt="Sincofarma DF" />
        <Link to={user ? "/minha-conta" : "/login"} className="policy-back">
          <ArrowLeft size={16} aria-hidden="true" /> {user ? "Voltar para minha conta" : "Voltar para o login"}
        </Link>
      </header>

      <main className="policy">
        <h1>Política de privacidade</h1>
        <p className="policy-date">Painel clínico de atendimento farmacêutico · atualizada em {data(PRIVACIDADE.atualizadaEm)}</p>

        <section>
          <h2>Quem cuida dos dados</h2>
          <p>
            O controlador é o <b>{PRIVACIDADE.controlador}</b>. Cada farmácia que usa o painel também
            responde pelos atendimentos que registra.
          </p>
          <p>
            <b>Encarregado de dados (DPO):</b>{" "}
            {encarregado.nome ? (
              <>
                {encarregado.nome}
                {encarregado.email && (
                  <> · <a href={`mailto:${encarregado.email}`}>{encarregado.email}</a></>
                )}
              </>
            ) : (
              "a ser nomeado pelo Sincofarma DF. Enquanto isso, fale com a farmácia ou com a administração do Sincofarma."
            )}
          </p>
        </section>

        <section>
          <h2>Que dados o painel guarda</h2>
          <h3>De quem usa o painel (farmacêuticos, médicos e administração)</h3>
          <ul>
            <li>Nome, CPF (usado como login), e-mail, CRF e farmácia em que trabalha.</li>
            <li>Senha (guardada só como código irreversível) e o app autenticador da verificação em duas etapas.</li>
            <li>Aparelhos marcados como confiáveis por 24 horas.</li>
            <li>O que fez no painel e quando: atendimentos registrados, fichas abertas, encaminhamentos, alterações.</li>
            <li>Registros técnicos de acesso, com endereço IP.</li>
          </ul>
          <h3>De pacientes atendidos nas farmácias</h3>
          <ul>
            <li>Identificação: nome, CPF, Cartão Nacional de Saúde, data de nascimento, sexo e telefone.</li>
            <li>
              Dados de saúde (dados sensíveis): queixa, histórico (alergias, doenças, medicamentos), sinais
              vitais, classificação de risco, sinais de alerta, observações e o desfecho do atendimento.
            </li>
            <li>Encaminhamentos a médicos, com o motivo e a resposta do médico.</li>
          </ul>
        </section>

        <section>
          <h2>Para que e com qual base legal</h2>
          <ul>
            <li>
              <b>Atendimento farmacêutico, triagem e encaminhamento:</b> tutela da saúde, por profissionais de
              saúde (LGPD, art. 7º, VIII, e art. 11, II, f).
            </li>
            <li>
              <b>Registro e guarda dos atendimentos e da responsabilidade técnica:</b> cumprimento de obrigação
              legal e regulatória (art. 7º, II, e art. 11, II, a).
            </li>
            <li>
              <b>Contas de acesso, segurança e auditoria:</b> execução do vínculo profissional e obrigação legal
              de segurança (art. 7º, II e V, e art. 46).
            </li>
          </ul>
          <p>Os dados não são vendidos nem usados para publicidade.</p>
        </section>

        <section>
          <h2>Com quem os dados são compartilhados</h2>
          <ul>
            <li><b>Médicos cadastrados no painel</b>, só quando o farmacêutico encaminha o atendimento a eles.</li>
            <li>
              <b>Amazon Web Services</b> (região de São Paulo): hospedagem, banco de dados e login, com
              criptografia e chave própria do Sincofarma.
            </li>
            <li><b>Vercel</b>: hospedagem das telas do painel; não guarda dados de pacientes.</li>
          </ul>
          <p>A integração com a RNDS (Ministério da Saúde) ainda não está ativa; quando estiver, esta página será atualizada.</p>
        </section>

        <section>
          <h2>Por quanto tempo</h2>
          <ul>
            <li>Atendimentos e encaminhamentos: pelo prazo exigido pelas normas sanitárias e de saúde.</li>
            <li>Registro de quem fez o quê: junto aos registros a que se refere.</li>
            <li>Registros técnicos de acesso (com IP): 90 dias.</li>
            <li>Conta de acesso: enquanto durar o vínculo; depois, é anonimizada a pedido.</li>
          </ul>
        </section>

        <section>
          <h2>Como protegemos</h2>
          <ul>
            <li>Login com senha forte e verificação em duas etapas obrigatória.</li>
            <li>Dados criptografados, com chave própria; sessões que encerram sozinhas por inatividade.</li>
            <li>Cada perfil vê só o necessário: a administração vê números, não listas de pacientes; o médico vê só o que foi encaminhado a ele.</li>
            <li>Toda abertura de ficha e toda alteração ficam registradas com quem fez e quando.</li>
          </ul>
        </section>

        <section>
          <h2>Seus direitos (art. 18)</h2>
          <p>Você pode confirmar se tratamos seus dados, ter acesso a eles, corrigi-los, saber com quem foram compartilhados, receber uma cópia e pedir a eliminação quando a lei permitir.</p>
          <h3>Se você usa o painel</h3>
          <p>
            Em <b>Minha conta → Privacidade e seus dados</b>: baixe um arquivo com tudo o que o painel guarda sobre
            você e peça correção ou exclusão da conta. A exclusão anonimiza a conta; os atendimentos que você
            registrou continuam guardados, como exige a norma sanitária.
          </p>
          <h3>Se você foi atendido numa farmácia</h3>
          <p>
            Peça na farmácia ou à administração do Sincofarma, com documento. Entregamos uma cópia de todos os seus
            atendimentos e encaminhamentos, incluindo com quais médicos foram compartilhados. Dados de saúde não podem
            ser apagados antes do prazo legal; correções são feitas pela farmácia que registrou o atendimento.
          </p>
          <p>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
        </section>

        <section>
          <h2>Armazenamento no navegador</h2>
          <p>
            O painel não usa cookies de rastreamento nem de publicidade. Guarda no navegador só o necessário para
            funcionar: a sessão de login (apagada ao sair), a preferência de animações, o horário da última atividade
            (para encerrar por inatividade) e, se você marcar "confiar neste computador", a chave desse aparelho por 24 horas.
          </p>
        </section>
      </main>
    </div>
  );
}
