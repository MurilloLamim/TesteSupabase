console.log("🚀 VERSÃO DA NUVEM CARREGADA!");

const supabaseUrl = "https://fmqjjzlkftdeynnvvprs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWpqemxrZnRkZXlubnZ2cHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQxMDQsImV4cCI6MjA4OTUyMDEwNH0.rEdlETx7-VeG03Zpj6T_kQfmfTD4mX7NKX9znh6WdC8";

// cria o cliente do supabase
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function callEdgeFunction(action, data) {
  const { data: { session } } = await supabaseClient.auth.getSession();

  const { data: responseData, error } = await supabaseClient.functions.invoke("posts", {
    body: { action, data },
    headers: {
      Authorization: session ? `Bearer ${session.access_token}` : undefined
    }
  });

  if (error) {
    console.error("Erro na Edge Function:", error);
    return { error: error.message };
  }

  return responseData;
}

// faz o login do usuario
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    alert(error.message);
  } else {
    window.location.href = "posts.html";
  }
}

// desloga o usuario e manda para a pagina de login
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// pega os valores
async function register() {
  const fullName = document.getElementById("fullName").value;
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!fullName || !username || !email || !password) {
    alert("Por favor, preencha todos os campos!");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username: username,
      },
    },
  });

  if (error) {
    alert(error.message);
  } else {
    alert("Conta criada!");
    window.location.href = "posts.html";
  }
}

async function createPost() {
  // 1. O Segurança do Front-end: Verifica se tem alguém logado ANTES de chamar a nuvem
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session) {
    alert("Você precisa fazer o login primeiro para criar um post!");
    window.location.href = "index.html"; // Mude para "login.html" se a sua tela de login ainda tiver esse nome
    return; // Esse 'return' faz a função parar aqui mesmo e não chama a Edge Function
  }

  // 2. Se estiver logado, pega os textos e manda pra cozinha (Edge Function)
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  // Validação extra: não deixa criar post vazio
  if (!title || !content) {
    alert("Por favor, preencha o título e o conteúdo!");
    return;
  }

  const result = await callEdgeFunction("create", { title, content });

  if (result && result.error) {
    alert(result.error);
  } else {
    // Limpa os campos após o post ser criado
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    loadPosts(); 
  }
}

async function updatePost(id, value, field) {
  const result = await callEdgeFunction("update", {
    id,
    field,
    value,
  });

  if (result && result.error) {
    alert(result.error);
  } else {
    console.log("Post atualizado!");
  }
}

async function deletePost(id) {
  const confirmDelete = confirm("Deseja deletar este post?");
  if (!confirmDelete) return;

  const result = await callEdgeFunction("delete", { id });

  if (result && result.error) {
    alert(result.error);
  } else {
    loadPosts();
  }
}

// carrega os posts na tela
async function loadPosts() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile && profile.role === "admin") {
      isAdmin = true;
    }
  }

  // A busca direta do banco está aqui!
  const { data, error } = await supabaseClient
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro do Supabase:", error);
    return;
  }

  const container = document.getElementById("posts");
  if (!container) return; 
  
  container.innerHTML = "";

  data?.forEach((post) => {
    const isOwner = user && user.id === post.user_id;
    const canEditOrDelete = isOwner || isAdmin;

    const div = document.createElement("div");
    div.classList.add("post");

    div.innerHTML = `
      <h3 contenteditable="${canEditOrDelete}" onBlur="updatePost('${post.id}', this.innerText, 'title')">
        ${post.title}
      </h3>

      <p contenteditable="${canEditOrDelete}" onBlur="updatePost('${post.id}', this.innerText, 'content')">
        ${post.content}
      </p>

      ${
        canEditOrDelete
          ? `<div class="actions">
            <button onclick="deletePost('${post.id}')">Deletar</button>
          </div>`
          : ""
      }
    `;

    container.appendChild(div);
  });
}

// carrega os posts se a pagina atual for a de posts
if (window.location.pathname.includes("posts.html")) {
  loadPosts();
}