import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "./components/providers/app-providers";
import AppLayout from "@/components/layout/app-layout";
import Chat from "./pages/Chat";
import New from "./pages/New";
import NotFound from "./pages/NotFound";
import Logs from "./pages/Logs";

const App = () => (
  <AppProviders>
    <BrowserRouter basename="/chataiagent">
      <Routes>
        {/* All routes inside AppLayout will have the persistent sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<New />} />
          <Route path="/new" element={<New />} />
          <Route path="/chat" element={<New />} />
          <Route path="/chat/:chatid" element={<Chat />} />
        </Route>
          <Route path="/logs" element={<Logs />} />

        {/* Routes outside the layout, like a 404 page, won't have the sidebar */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </AppProviders>
);

export default App;
