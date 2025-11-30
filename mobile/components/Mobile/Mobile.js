import React, { PureComponent } from "react";
import MobileClient from "../MobileClient/MobileClient";
import EventEmitter from "../../utils/EventEmitter";
import "./Mobile.css";

class Mobile extends PureComponent {
  constructor(props) {
    super(props);

    this.events = new EventEmitter();
    this.idCounter = Date.now();

    this.state = {
      clients: this.initializeClients(props.clients),
      filter: "all",
    };
  }

  componentDidMount() {
    this.setupEventListeners();
    console.log("📱 Mobile: Component mounted with event listeners");
  }

  componentWillUnmount() {
    this.cleanupEventListeners();
    console.log("📱 Mobile: Component unmounted, event listeners cleaned");
  }

  render() {
    console.log("🔄 Mobile render called");
    const { filter } = this.state;
    const filteredClients = this.getFilteredClients();

    return (
      <div className="mobile-container">
        <h1>Управление клиентами</h1>

        <div className="controls">
          <button onClick={this.handleAddClient} className="btn-add">
            + Добавить клиента
          </button>

          <div className="filters">
            <button
              onClick={() => this.handleFilterChange("all")}
              className={filter === "all" ? "active" : ""}
            >
              Все
            </button>
            <button
              onClick={() => this.handleFilterChange("active")}
              className={filter === "active" ? "active" : ""}
            >
              Активные
            </button>
            <button
              onClick={() => this.handleFilterChange("blocked")}
              className={filter === "blocked" ? "active" : ""}
            >
              Заблокированные
            </button>
          </div>
        </div>

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
              <MobileClient
                key={client.id}
                client={client}
                events={this.events}
              />
            ))}
          </tbody>
        </table>

        <div className="stats">
          Всего: {this.state.clients.length} | Активных:{" "}
          {this.state.clients.filter((c) => c.status === "active").length} |
          Заблокированных:{" "}
          {this.state.clients.filter((c) => c.status === "blocked").length}
        </div>
      </div>
    );
  }

  /**
   * Централизованная настройка подписок
   */
  setupEventListeners = () => {
    this.events.on("clientUpdated", this.handleClientUpdate);
    this.events.on("clientDeleted", this.handleClientDelete);

    console.log(
      "✅ Mobile: Event listeners subscribed",
      this.events.getStats()
    );
  };

  /**
   * Гарантированная очистка подписок
   */
  cleanupEventListeners = () => {
    this.events.off("clientUpdated", this.handleClientUpdate);
    this.events.off("clientDeleted", this.handleClientDelete);

    this.events.removeAllListeners();

    console.log("🧹 Mobile: Event listeners cleaned", this.events.getStats());
  };

  /**
   * Иммутабельная инициализация клиентов
   */
  initializeClients = (initialClients) => {
    return initialClients.map((client) => ({
      ...client,
      balance: client.balance || 0,
      id: client.id || this.generateId(),
    }));
  };

  generateId = () => {
    return this.idCounter++;
  };

  /**
   * Обработчики событий
   */
  handleClientUpdate = (oldClient, newClient) => {
    this.setState((prevState) => ({
      clients: prevState.clients.map((client) =>
        client.id === oldClient.id ? { ...newClient, id: oldClient.id } : client
      ),
    }));
  };

  handleClientDelete = (clientToDelete) => {
    this.setState((prevState) => ({
      clients: prevState.clients.filter(
        (client) => client.id !== clientToDelete.id
      ),
    }));
  };

  handleAddClient = () => {
    this.setState((prevState) => ({
      clients: [
        ...prevState.clients,
        {
          id: this.generateId(),
          surname: "Фамилия",
          name: "Имя",
          patronymic: "Отчество",
          balance: 0,
          status: "active",
        },
      ],
    }));
  };

  handleFilterChange = (filter) => {
    this.setState({ filter });
  };

  getFilteredClients = () => {
    const { clients, filter } = this.state;
    switch (filter) {
      case "active":
        return clients.filter((c) => c.status === "active");
      case "blocked":
        return clients.filter((c) => c.status === "blocked");
      default:
        return clients;
    }
  };
}

export default Mobile;
