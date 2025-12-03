import React, { useRef, useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./MobileClient.css";

const MobileClient = ({ client, events }) => {
  console.log(`👤 MobileClient render: ${client.surname} ${client.name}`);

  const [isEditing, setIsEditing] = useState(false);

  const surnameRef = useRef(null);
  const nameRef = useRef(null);
  const patronymicRef = useRef(null);
  const balanceRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      surnameRef.current.value = client.surname;
      nameRef.current.value = client.name;
      patronymicRef.current.value = client.patronymic || "";
      balanceRef.current.value = client.balance;
    }
  }, [isEditing, client]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    const updatedClient = {
      ...client,
      surname: surnameRef.current.value,
      name: nameRef.current.value,
      patronymic: patronymicRef.current.value,
      balance: Number(balanceRef.current.value) || 0,
      status: Number(balanceRef.current.value) >= 0 ? "active" : "blocked",
    };

    events.emit("clientUpdated", client, updatedClient);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    events.emit("clientDeleted", client);
  };

  return (
    <tr>
      <td>
        {isEditing ? (
          <input
            type="text"
            ref={surnameRef}
            className="edit-input"
            placeholder="Фамилия"
          />
        ) : (
          client.surname
        )}
      </td>

      <td>
        {isEditing ? (
          <input
            type="text"
            ref={nameRef}
            className="edit-input"
            placeholder="Имя"
          />
        ) : (
          client.name
        )}
      </td>

      <td>
        {isEditing ? (
          <input
            type="text"
            ref={patronymicRef}
            className="edit-input"
            placeholder="Отчество"
          />
        ) : (
          client.patronymic || "-"
        )}
      </td>

      <td>
        {isEditing ? (
          <input
            type="number"
            ref={balanceRef}
            className="edit-input"
            placeholder="Баланс"
          />
        ) : (
          client.balance
        )}
      </td>

      <td className={`status ${client.status}`}>
        {client.status === "active" ? "Активный" : "Заблокированный"}
      </td>

      <td className="actions">
        {isEditing ? (
          <>
            <button
              onClick={handleSaveClick}
              className="btn-save"
              title="Сохранить изменения"
            >
              💾
            </button>
            <button
              onClick={handleCancelClick}
              className="btn-cancel"
              title="Отменить редактирование"
            >
              ✖️
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleEditClick}
              className="btn-edit"
              title="Редактировать клиента"
            >
              ✏️
            </button>
            <button
              onClick={handleDeleteClick}
              className="btn-delete"
              title="Удалить клиента"
            >
              🗑️
            </button>
          </>
        )}
      </td>
    </tr>
  );
};

MobileClient.propTypes = {
  client: PropTypes.shape({
    id: PropTypes.number,
    surname: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    patronymic: PropTypes.string,
    balance: PropTypes.number.isRequired,
    status: PropTypes.oneOf(["active", "blocked"]).isRequired,
  }).isRequired,
  events: PropTypes.object.isRequired,
};

const arePropsEqual = (prevProps, nextProps) => {
  const prevClient = prevProps.client;
  const nextClient = nextProps.client;

  const isClientEqual =
    prevClient.id === nextClient.id &&
    prevClient.surname === nextClient.surname &&
    prevClient.name === nextClient.name &&
    prevClient.patronymic === nextClient.patronymic &&
    prevClient.balance === nextClient.balance &&
    prevClient.status === nextClient.status;

  const isEventsEqual = prevProps.events === nextProps.events;

  return isClientEqual && isEventsEqual;
};

export default React.memo(MobileClient, arePropsEqual);
