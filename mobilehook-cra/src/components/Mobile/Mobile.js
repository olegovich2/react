import React, { useState, useMemo, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import MobileClient from "../MobileClient/MobileClient";
import EventEmitter from "../../utils/EventEmitter";
import "./Mobile.css";

const Mobile = ({ initialClients }) => {
  console.log("📱 Mobile render");

  // EventEmitter
  const eventsRef = useRef(new EventEmitter());
  const events = eventsRef.current;

  const [clients, setClients] = useState(() => {
    return initialClients.map((client) => ({
      ...client,
      id: client.id || Date.now(),
    }));
  });

  const [filter, setFilter] = useState("all");

  // Подписка на события
  useEffect(() => {
    console.log("✅ Mobile: Подписка на события");

    const handleClientUpdate = (oldClient, newClient) => {
      setClients((prevClients) =>
        prevClients.map((client) =>
          client.id === oldClient.id
            ? { ...newClient, id: oldClient.id }
            : client
        )
      );
    };

    const handleClientDelete = (clientToDelete) => {
      setClients((prevClients) =>
        prevClients.filter((client) => client.id !== clientToDelete.id)
      );
    };

    // Подписываемся на события
    events.on("clientUpdated", handleClientUpdate);
    events.on("clientDeleted", handleClientDelete);

    // Отписка при размонтировании
    return () => {
      events.off("clientUpdated", handleClientUpdate);
      events.off("clientDeleted", handleClientDelete);
    };
  }, [events]);

  // Добавление нового клиента
  const handleAddClient = () => {
    console.log("➕ Добавление нового клиента");

    const newClient = {
      id: Date.now(),
      surname: "Фамилия",
      name: "Имя",
      patronymic: "Отчество",
      balance: 0,
      status: "active",
    };

    setClients((prevClients) => [...prevClients, newClient]);
  };

  // Мемоизированные отфильтрованные клиенты
  const filteredClients = useMemo(() => {
    switch (filter) {
      case "active":
        return clients.filter((client) => client.status === "active");
      case "blocked":
        return clients.filter((client) => client.status === "blocked");
      default:
        return clients;
    }
  }, [clients, filter]);

  // Мемоизированная статистика
  const stats = useMemo(() => {
    const active = clients.filter((c) => c.status === "active").length;
    const blocked = clients.filter((c) => c.status === "blocked").length;

    return {
      total: clients.length,
      active,
      blocked,
    };
  }, [clients]);

  return (
    <div className="mobile-container">
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
            {filteredClients.map((client) => (
              <MobileClient key={client.id} client={client} events={events} />
            ))}
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

Mobile.propTypes = {
  initialClients: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      surname: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      patronymic: PropTypes.string,
      balance: PropTypes.number.isRequired,
      status: PropTypes.oneOf(["active", "blocked"]).isRequired,
    })
  ).isRequired,
};

Mobile.defaultProps = {
  initialClients: [],
};

export default React.memo(Mobile);
