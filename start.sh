
set -e

FETCH_DATE=""
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --fetch-date) FETCH_DATE="$2"; shift ;;
  esac
  shift
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📈  NEPSE Dashboard Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd backend

if [ ! -d "venv" ]; then
  echo "⚙️  Creating Python virtual environment…"
  python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Installing Python dependencies…"
pip install -r requirements.txt -q

if [ -n "$FETCH_DATE" ]; then
  echo "📥 Fetching data for $FETCH_DATE …"
  python fetcher.py "$FETCH_DATE"
else
  echo "📥 Fetching today's data…"
  python fetcher.py
fi

echo "🚀 Starting FastAPI on http://localhost:8000 …"
uvicorn api:app --host 0.0.0.0 --port 8000 &
API_PID=$!
echo "   FastAPI PID: $API_PID"

echo "⏰ Starting hourly scheduler…"
python fetcher.py --scheduler &
SCHED_PID=$!
echo "   Scheduler PID: $SCHED_PID"

cd ..

cd frontend
if [ ! -d "node_modules" ]; then
  echo "📦 Installing Node dependencies…"
  npm install
fi

echo "🌐 Starting Next.js on http://localhost:3000 …"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All services running!"
echo "  🌐 Dashboard → http://localhost:3000"
echo "  🔌 API Docs  → http://localhost:8000/docs"
echo "  (Press Ctrl+C to stop)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cleanup() {
  echo ""
  echo "🛑 Stopping services…"
  kill $API_PID $SCHED_PID 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

npm run dev
