import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, TriangleAlert, ListFilter, Settings2 } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import Select from "../../components/Select";
import { repository } from "../../data";
import { useClinic } from "../../contexts/clinic";
import { PAPEIS } from "../../services/permissoes";
import { initials } from "../../utils/initials";
import { rise, press } from "../../utils/motion";
import UserModal from "./UserModal";
import "./Usuarios.css";

const ROLE_TONE = { farmaceutico: "green", medico: "blue", admin: "purple" };

function situacao(u) {
  if (!u.enabled) return { label: "Desativado", tone: "off" };
  if (u.pending) return { label: "Aguardando 1º acesso", tone: "pending" };
  return { label: "Ativo", tone: "on" };
}

function RoleChips({ roles }) {
  if (!roles.length) return <span className="role-chip role-chip--none">Sem perfil</span>;
  return roles.map((r) => (
    <span key={r} className={`role-chip role-chip--${ROLE_TONE[r] ?? "none"}`}>{PAPEIS[r] ?? r}</span>
  ));
}

/** Administração: quem acessa o painel, com que perfil e em qual farmácia. */
export default function Usuarios() {
  const { notify } = useClinic();
  const [data, setData] = useState({ users: [], units: [] });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [editing, setEditing] = useState(null); // null | "new" | usuário

  // estado só muda quando a resposta chega (nada síncrono dentro do efeito)
  const fetchUsers = useCallback(() => {
    repository.listUsers().then(
      (res) => {
        setData(res);
        setStatus("ready");
      },
      (err) => {
        setError(err.message || "Não foi possível carregar os usuários.");
        setStatus("error");
      }
    );
  }, []);
  useEffect(fetchUsers, [fetchUsers]);
  const load = () => {
    setStatus("loading");
    fetchUsers();
  };

  const unitName = useMemo(() => Object.fromEntries(data.units.map((u) => [u.id, u.name])), [data.units]);
  const term = q.trim().toLowerCase();
  const users = data.users.filter(
    (u) => (role === "all" || u.roles.includes(role)) && (!term || `${u.name} ${u.email}`.toLowerCase().includes(term))
  );
  const counts = {
    total: data.users.length,
    ativos: data.users.filter((u) => u.enabled && !u.pending).length,
    pendentes: data.users.filter((u) => u.enabled && u.pending).length,
    desativados: data.users.filter((u) => !u.enabled).length,
  };

  function saved(user, created) {
    setData((d) => ({
      ...d,
      users: created ? [...d.users, user].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) : d.users.map((u) => (u.id === user.id ? user : u)),
    }));
    if (created) notify(`Convite enviado para ${user.email}.`, "success");
  }

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Gestão</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Usuários</motion.h1>
          <motion.p className="hello" {...rise(2)}>
            Quem acessa o painel, com qual perfil e em qual farmácia.
          </motion.p>
        </div>
        <motion.div className="page-actions" {...rise(2)}>
          <motion.button type="button" className="btn btn--primary" onClick={() => setEditing("new")} {...press}>
            <span className="btn-shine" aria-hidden="true" />
            <UserPlus size={16} />
            Novo usuário
          </motion.button>
        </motion.div>
      </section>

      <motion.dl className="user-stats" {...rise(3)}>
        <div><dt>Total</dt><dd>{counts.total}</dd></div>
        <div><dt>Ativos</dt><dd>{counts.ativos}</dd></div>
        <div><dt>Aguardando 1º acesso</dt><dd>{counts.pendentes}</dd></div>
        <div><dt>Desativados</dt><dd>{counts.desativados}</dd></div>
      </motion.dl>

      {status === "error" && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{error}</span>
          <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      <SpotlightCard index={4} className="table-card">
        <header className="card-head">
          <div>
            <h2>Pessoas com acesso</h2>
            <p>Clique em uma pessoa para mudar perfil, farmácia ou acesso.</p>
          </div>
          <div className="table-tools">
            <label className="user-search">
              <Search size={14} aria-hidden="true" />
              <span className="sr-only">Buscar por nome ou e-mail</span>
              <input type="search" placeholder="Nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Select
              className={`btn-filter${role !== "all" ? " is-filtered" : ""}`}
              icon={ListFilter}
              label="Filtrar por perfil"
              value={role}
              onChange={setRole}
              options={[{ value: "all", label: "Todos os perfis" }, ...Object.entries(PAPEIS).map(([k, l]) => ({ value: k, label: l }))]}
            />
          </div>
        </header>

        <div className="table-scroll">
          <table className="visits users-table">
            <thead>
              <tr>
                <th>PESSOA</th>
                <th>CPF</th>
                <th>PERFIL</th>
                <th>FARMÁCIA</th>
                <th>SITUAÇÃO</th>
                <th className="ta-center">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" && (
                <tr><td colSpan={6} className="empty">Carregando usuários…</td></tr>
              )}
              {status === "ready" && users.length === 0 && (
                <tr><td colSpan={6} className="empty">Nenhum usuário encontrado.</td></tr>
              )}
              {users.map((u) => {
                const s = situacao(u);
                return (
                  <tr key={u.id} className={`visit-row${u.enabled ? "" : " is-off"}`} onClick={() => setEditing(u)}>
                    <td>
                      <div className="patient">
                        <span className={`avatar avatar--${ROLE_TONE[u.roles[0]] === "purple" ? "amber" : ROLE_TONE[u.roles[0]] ?? "blue"}`}>
                          {initials(u.name)}
                        </span>
                        <div>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{u.cpf}</td>
                    <td><div className="role-chips"><RoleChips roles={u.roles} /></div></td>
                    <td>{u.unit ? unitName[u.unit] ?? u.unit : <span className="muted">—</span>}</td>
                    <td><span className={`user-status user-status--${s.tone}`}>{s.label}</span></td>
                    <td className="ta-center">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Gerenciar ${u.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(u);
                        }}
                      >
                        <Settings2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      <UserModal
        open={!!editing}
        user={editing === "new" ? null : editing}
        units={data.units}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </main>
  );
}
