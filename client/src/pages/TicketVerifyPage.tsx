
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { verifyPublicTicket, type TicketVerification } from "../api";

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TicketVerifyPage() {
  const { token } = useParams<{ token: string }>();

  const [ticket, setTicket] = useState<TicketVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setError("Không tìm thấy mã QR vé.");
        setLoading(false);
        return;
      }

      try {
        const response = await verifyPublicTicket(token);

        if (!cancelled) {
          setTicket(response.item);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể xác minh vé.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main style={styles.container}>
        <section style={styles.card}>
          <p>Đang xác minh vé...</p>
        </section>
      </main>
    );
  }

  if (error || !ticket) {
    return (
      <main style={styles.container}>
        <section style={styles.card}>
          <h1 style={styles.invalid}>Không thể xác minh vé</h1>
          <p>{error || "Không tìm thấy thông tin vé."}</p>
          <Link to="/">Về trang chủ</Link>
        </section>
      </main>
    );
  }

  const valid = ticket.valid;

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        <h1 style={valid ? styles.valid : styles.invalid}>
          {valid ? "VÉ HỢP LỆ" : "VÉ KHÔNG HỢP LỆ"}
        </h1>

        <p style={styles.message}>{ticket.message}</p>

        <hr />

        <h2>Thông tin vé</h2>
        <p>
          <strong>Mã vé:</strong> {ticket.ticket.ticketCode}
        </p>
        <p>
          <strong>Trạng thái vé:</strong> {ticket.ticket.status}
        </p>
        <p>
          <strong>Hành khách:</strong> {ticket.passenger.fullName}
        </p>
        <p>
          <strong>Đặt chỗ:</strong> {ticket.booking.status}
        </p>

        <hr />

        <h2>Thông tin chuyến bay</h2>
        <p>
          <strong>Hãng hàng không:</strong> {ticket.flight.airlineName} (
          {ticket.flight.airlineCode})
        </p>
        <p>
          <strong>Chuyến bay:</strong> {ticket.flight.flightNumber}
        </p>
        <p>
          <strong>Hành trình:</strong> {ticket.flight.departureCode} →{" "}
          {ticket.flight.arrivalCode}
        </p>
        <p>
          <strong>Khởi hành:</strong>{" "}
          {formatDateTime(ticket.flight.departureTime)}
        </p>
        <p>
          <strong>Trạng thái chuyến bay:</strong> {ticket.flight.status}
        </p>

        <hr />

        <p style={styles.note}>
          Đây là trang xác minh thông tin vé. Việc quét QR không tự động
          thực hiện thủ tục check-in.
        </p>

        <Link to="/">Về trang chủ</Link>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    padding: "32px 16px",
    background: "#f3f4f6",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    padding: "28px",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
    overflowWrap: "anywhere",
  },
  valid: {
    color: "#15803d",
    textAlign: "center",
  },
  invalid: {
    color: "#b91c1c",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    fontSize: "16px",
  },
  note: {
    color: "#555555",
    fontSize: "13px",
  },
};

export default TicketVerifyPage;
