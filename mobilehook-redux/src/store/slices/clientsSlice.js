import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchCompanyData = createAsyncThunk(
  "clients/fetchCompanyData",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(
        "https://fe.it-academy.by/Examples/mobile_company.json",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const clientsSlice = createSlice({
  name: "clients",
  initialState: {
    companyName: "",
    clientsArr: [],
    error: null,
  },
  reducers: {
    addClient: (state, action) => {
      const newClient = {
        id: Date.now(),
        fam: action.payload.surname,
        im: action.payload.name,
        otch: action.payload.patronymic,
        balance: action.payload.balance,
      };
      state.clientsArr.push(newClient);
    },

    updateClient: (state, action) => {
      const { id, ...updatedData } = action.payload;
      const index = state.clientsArr.findIndex((client) => client.id === id);
      if (index !== -1) {
        state.clientsArr[index] = {
          ...state.clientsArr[index],
          fam: updatedData.surname,
          im: updatedData.name,
          otch: updatedData.patronymic,
          balance: updatedData.balance,
        };
      }
    },

    deleteClient: (state, action) => {
      const id = action.payload;
      state.clientsArr = state.clientsArr.filter((client) => client.id !== id);
    },

    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder

      .addCase(fetchCompanyData.fulfilled, (state, action) => {
        state.companyName = action.payload.companyName || "";
        state.clientsArr = action.payload.clientsArr || [];
        if (state.error) state.error = null;
      })
      .addCase(fetchCompanyData.rejected, (state, action) => {
        state.error = action.payload || "Ошибка загрузки";
      });
  },
});

export const { addClient, updateClient, deleteClient, clearError } =
  clientsSlice.actions;
export default clientsSlice.reducer;
