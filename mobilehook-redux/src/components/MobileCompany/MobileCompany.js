import React, { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCompanyData,
  addClient,
  updateClient,
  deleteClient,
} from "../../store/slices/clientsSlice";
import MobileClient from "../MobileClient/MobileClient";
import "./MobileCompany.css";

const MobileCompany = () => {
  console.log("🏢 MobileCompany render");

  const dispatch = useDispatch();

  // Получаем данные из Redux
  const { companyName, clientsArr, error } = useSelector(
    (state) => state.clients
  );

  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (clientsArr.length === 0) {
      console.log("📡 Загрузка данных компании...");
      dispatch(fetchCompanyData());
    }
  }, [dispatch, clientsArr.length]);

  const handleAddClient = () => {
    console.log("➕ Добавление нового клиента");
    const newClient = {
      surname: "Фамилия",
      name: "Имя",
      patronymic: "Отчество",
      balance: 0,
    };
    dispatch(addClient(newClient));
  };

  const handleClientUpdate = (oldClient, updatedClient) => {
    console.log("✏️ Обновление клиента:", oldClient.id);
    dispatch(
      updateClient({
        id: oldClient.id,
        ...updatedClient,
      })
    );
  };

  const handleClientDelete = (clientToDelete) => {
    console.log("🗑️ Удаление клиента:", clientToDelete.id);
    dispatch(deleteClient(clientToDelete.id));
  };

  const { filteredClients, stats } = useMemo(() => {
    console.log("📊 Вычисляем преобразованные данные и статистику");

    // Преобразование данных из формата API в наш внутренний формат
    const transformedClients = clientsArr.map((client) => ({
      id: client.id,
      surname: client.fam,
      name: client.im,
      patronymic: client.otch,
      balance: client.balance,
      status: client.balance >= 0 ? "active" : "blocked",
    }));

    // Фильтрация клиентов по статусу
    let filtered;
    switch (filter) {
      case "active":
        filtered = transformedClients.filter(
          (client) => client.status === "active"
        );
        break;
      case "blocked":
        filtered = transformedClients.filter(
          (client) => client.status === "blocked"
        );
        break;
      default:
        filtered = transformedClients;
    }

    // Вычисление статистики
    const active = transformedClients.filter(
      (c) => c.status === "active"
    ).length;
    const blocked = transformedClients.filter(
      (c) => c.status === "blocked"
    ).length;

    return {
      filteredClients: filtered,
      stats: {
        total: transformedClients.length,
        active,
        blocked,
      },
    };
  }, [clientsArr, filter]);

  if (error && clientsArr.length === 0) {
    console.log("❌ Рендерим ошибку:", error);
    return (
      <div className="mobile-container">
        <div className="error">
          Ошибка загрузки: {error}
          <button
            onClick={() => dispatch(fetchCompanyData())}
            className="retry-btn"
          >
            Повторить загрузку
          </button>
        </div>
      </div>
    );
  }

  console.log("✅ Рендерим основной интерфейс с данными");

  return (
    <div className="mobile-container">
      <h1>{companyName || "Мобильная компания"}</h1>

      <div className="controls">
        <button
          onClick={handleAddClient}
          className="btn-add"
          title="Добавить нового клиента"
        >
          + Добавить клиента
        </button>

        <div className="filters">
          <button
            onClick={() => setFilter("all")}
            className={filter === "all" ? "active" : ""}
          >
            Все ({stats.total})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={filter === "active" ? "active" : ""}
          >
            Активные ({stats.active})
          </button>
          <button
            onClick={() => setFilter("blocked")}
            className={filter === "blocked" ? "active" : ""}
          >
            Заблокированные ({stats.blocked})
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="clients-table">
          <thead>
            <tr>
              <th>Фамилия</th>
              <th>Имя</th>
              <th>Отчество</th>
              <th>Баланс</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <MobileClient
                  key={client.id}
                  client={client}
                  onUpdate={handleClientUpdate}
                  onDelete={handleClientDelete}
                />
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-clients">
                  Нет клиентов по выбранному фильтру
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="stats">
        <span className="stat-item">
          Всего клиентов: <strong>{stats.total}</strong>
        </span>
        <span className="stat-separator">|</span>
        <span className="stat-item">
          Активных: <strong className="active">{stats.active}</strong>
        </span>
        <span className="stat-separator">|</span>
        <span className="stat-item">
          Заблокированных: <strong className="blocked">{stats.blocked}</strong>
        </span>
      </div>
    </div>
  );
};

export default React.memo(MobileCompany);
