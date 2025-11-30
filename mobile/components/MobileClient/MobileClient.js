import React, { PureComponent, createRef } from "react";
import PropTypes from "prop-types";
import "./MobileClient.css";

class MobileClient extends PureComponent {
  constructor(props) {
    super(props);

    this.surnameRef = createRef();
    this.nameRef = createRef();
    this.patronymicRef = createRef();
    this.balanceRef = createRef();

    this.state = {
      isEditing: false,
    };
  }

  render() {
    console.log(`👤 MobileClient ${this.props.client.surname} render`);

    const { client } = this.props;
    const { isEditing } = this.state;

    return (
      <tr>
        <td>
          {isEditing ? (
            <input
              type="text"
              ref={this.surnameRef}
              defaultValue={client.surname}
              className="edit-input"
            />
          ) : (
            client.surname
          )}
        </td>

        <td>
          {isEditing ? (
            <input
              type="text"
              ref={this.nameRef}
              defaultValue={client.name}
              className="edit-input"
            />
          ) : (
            client.name
          )}
        </td>

        <td>
          {isEditing ? (
            <input
              type="text"
              ref={this.patronymicRef}
              defaultValue={client.patronymic}
              className="edit-input"
            />
          ) : (
            client.patronymic
          )}
        </td>

        <td>
          {isEditing ? (
            <input
              type="number"
              ref={this.balanceRef}
              defaultValue={client.balance || 0}
              className="edit-input"
            />
          ) : (
            client.balance || 0
          )}
        </td>

        <td className={`status ${client.status}`}>
          {client.status === "active" ? "Активный" : "Заблокированный"}
        </td>

        <td className="actions">
          {isEditing ? this.renderEditButtons() : this.renderViewButtons()}
        </td>
      </tr>
    );
  }

  handleEdit = () => {
    this.setState({ isEditing: true });
  };

  handleSave = () => {
    const updatedClient = {
      ...this.props.client,
      surname: this.surnameRef.current.value,
      name: this.nameRef.current.value,
      patronymic: this.patronymicRef.current.value,
      balance: parseInt(this.balanceRef.current.value) || 0,
    };

    updatedClient.status = updatedClient.balance >= 0 ? "active" : "blocked";

    this.props.events.emit("clientUpdated", this.props.client, updatedClient);
    this.setState({ isEditing: false });
  };

  handleCancel = () => {
    this.setState({ isEditing: false });
  };

  handleDelete = () => {
    this.props.events.emit("clientDeleted", this.props.client);
  };

  renderEditButtons() {
    return (
      <div>
        <button onClick={this.handleSave} className="btn-save">
          ✅
        </button>
        <button onClick={this.handleCancel} className="btn-cancel">
          ❌
        </button>
      </div>
    );
  }

  renderViewButtons() {
    return (
      <div>
        <button onClick={this.handleEdit} className="btn-edit">
          ✏️
        </button>
        <button onClick={this.handleDelete} className="btn-delete">
          🗑️
        </button>
      </div>
    );
  }
}

MobileClient.propTypes = {
  client: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    surname: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    patronymic: PropTypes.string,
    balance: PropTypes.number,
    status: PropTypes.oneOf(["active", "blocked"]),
  }).isRequired,
  events: PropTypes.object.isRequired,
};

export default MobileClient;
