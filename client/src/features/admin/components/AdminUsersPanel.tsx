import { useQuery } from "@tanstack/react-query";
import { Check, Minus, ShieldCheck, UserCog } from "lucide-react";
import { STAFF_ROLE_ACCESS, type StaffRole } from "@shared/staff-access";
import { getQueryFn } from "@/lib/queryClient";

interface StaffAccountRow {
  id: number;
  username: string;
  displayName: string;
  isActive: boolean;
  role: StaffRole;
}

interface StaffListResponse {
  admins: StaffAccountRow[];
  evaluators: StaffAccountRow[];
}

const ROLE_ICON: Record<StaffRole, typeof ShieldCheck> = {
  admin: ShieldCheck,
  evaluator: UserCog,
};

export default function AdminUsersPanel() {
  const staffListQuery = useQuery<StaffListResponse>({
    queryKey: ["/api/admin/staff"],
    queryFn: getQueryFn<StaffListResponse>({ on401: "returnNull" }),
  });

  const accounts = [
    ...(staffListQuery.data?.admins || []),
    ...(staffListQuery.data?.evaluators || []),
  ];

  if (staffListQuery.isLoading) {
    return <div className="dns-admin-users-empty">Загрузка учётных записей…</div>;
  }

  if (staffListQuery.isError) {
    return <div className="dns-admin-users-empty">Не удалось загрузить список пользователей.</div>;
  }

  const adminCount = staffListQuery.data?.admins.length || 0;
  const evaluatorCount = staffListQuery.data?.evaluators.length || 0;
  const disabledCount = accounts.filter((account) => !account.isActive).length;

  return (
    <div className="dns-admin-users">
      <div className="dns-admin-users-summary">
        <div className="dns-admin-users-summary-item">
          <strong>{accounts.length}</strong>
          <span>всего учётных записей</span>
        </div>
        <div className="dns-admin-users-summary-item">
          <strong>{adminCount}</strong>
          <span>с правами администратора</span>
        </div>
        <div className="dns-admin-users-summary-item">
          <strong>{evaluatorCount}</strong>
          <span>оценщиков</span>
        </div>
        <div className="dns-admin-users-summary-item">
          <strong>{disabledCount}</strong>
          <span>отключено</span>
        </div>
      </div>

      <section className="dns-admin-users-block">
        <h3 className="dns-admin-users-block-title">Заведённые пользователи</h3>
        <div className="dns-admin-users-table-wrap">
          <table className="dns-admin-users-table">
            <thead>
              <tr>
                <th scope="col">Имя</th>
                <th scope="col">Логин</th>
                <th scope="col">Роль</th>
                <th scope="col">Состояние</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const RoleIcon = ROLE_ICON[account.role];
                return (
                  <tr key={`${account.role}-${account.id}`}>
                    <td>{account.displayName}</td>
                    <td className="dns-admin-users-login">{account.username}</td>
                    <td>
                      <span className={`dns-admin-users-role dns-admin-users-role--${account.role}`}>
                        <RoleIcon aria-hidden="true" />
                        {STAFF_ROLE_ACCESS[account.role].title}
                      </span>
                    </td>
                    <td>
                      <span className={account.isActive ? "dns-admin-users-state dns-admin-users-state--on" : "dns-admin-users-state"}>
                        {account.isActive ? "Активна" : "Отключена"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="dns-admin-users-note">
          Учётные записи заводятся на стенде командой <code>npm run staff:create</code>. Из интерфейса
          пароли не выдаются и не показываются.
        </p>
      </section>

      <section className="dns-admin-users-block">
        <h3 className="dns-admin-users-block-title">Безопасность: что разрешает каждая роль</h3>
        <div className="dns-admin-users-access-grid">
          {(Object.keys(STAFF_ROLE_ACCESS) as StaffRole[]).map((role) => {
            const access = STAFF_ROLE_ACCESS[role];
            const RoleIcon = ROLE_ICON[role];
            return (
              <article key={role} className={`dns-admin-users-access-card dns-admin-users-access-card--${role}`}>
                <header className="dns-admin-users-access-head">
                  <RoleIcon aria-hidden="true" />
                  <div>
                    <strong>{access.title}</strong>
                    <span>{access.summary}</span>
                  </div>
                </header>
                <div className="dns-admin-users-access-body">
                  <div className="dns-admin-users-access-list">
                    <h4>Может</h4>
                    <ul>
                      {access.allowed.map((item) => (
                        <li key={item}><Check aria-hidden="true" />{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="dns-admin-users-access-list dns-admin-users-access-list--denied">
                    <h4>Не может</h4>
                    {access.denied.length > 0 ? (
                      <ul>
                        {access.denied.map((item) => (
                          <li key={item}><Minus aria-hidden="true" />{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dns-admin-users-access-full">Ограничений нет — полный доступ.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
