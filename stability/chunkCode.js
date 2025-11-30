{
  /* Панель отладки для разработки */
}
{
  process.env.NODE_ENV === "development" && (
    <div
      style={{
        background: "#e3f2fd",
        padding: "8px",
        marginBottom: "10px",
        borderRadius: "4px",
        border: "1px solid #2196F3",
      }}
    >
      <button
        onClick={this.debugEventListeners}
        style={{
          background: "#2196F3",
          color: "white",
          border: "none",
          padding: "5px 10px",
          borderRadius: "3px",
          fontSize: "12px",
        }}
      >
        🔍 Статус подписок
      </button>
      <span style={{ marginLeft: "10px", fontSize: "12px", color: "#1976D2" }}>
        Разработка:{" "}
        {Object.values(this.events.getStats()).reduce((a, b) => a + b, 0)}{" "}
        активных подписок
      </span>
    </div>
  );
}

/**
 * Дополнительный метод для отладки
 */
debugEventListeners = () => {
  console.log("🔍 Mobile: Current event listeners:", this.events.getStats());
};
