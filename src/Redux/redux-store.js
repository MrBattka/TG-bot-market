import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";
import persistReducer from "redux-persist/es/persistReducer";
import persistStore from "redux-persist/es/persistStore";
import storage from "redux-persist/lib/storage";

let reducers = combineReducers({
  
});

const persistConfig = {
  key: "root",
  storage: storage
  // blacklist: ['profilePage']
};
const pReducer = persistReducer(persistConfig, reducers);

const middleware = {
  immutableCheck: false,
  serializableCheck: false,
  thunk: true,
};

export let store = configureStore({
  reducer: pReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(middleware),
  devTools: process.env.NODE_ENV !== "production",
});

export const persistor = persistStore(store);