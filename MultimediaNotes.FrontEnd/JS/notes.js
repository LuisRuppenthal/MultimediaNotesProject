import { GETAnnotationsByUserId, PUTAnnotation, DELETEAnnotation, GETAnnotationById } from "./api.js";
import { getMediaFilesByAnnotation, deleteMediaFile, createFilePreview, uploadMediaFile, validateFile } from "./mediaFileApi.js";
import authService from "./auth.js";

// Variável global para armazenar novos arquivos selecionados no modal
let editSelectedFiles = [];

/* --- Excluir nota via API (DELETE) ------------ */
async function excluirNota(id) {
  const confirmacao = confirm("Tem certeza que deseja excluir esta anotação?");
  if (!confirmacao) return;

  try {
    const sucesso = await DELETEAnnotation("http://localhost:5145/api/Annotation", id);

    if (sucesso) {
      alert("Anotação excluída com sucesso.");
      location.reload();
    } else {
      alert("Erro ao excluir anotação. Tente novamente.");
    }
  } catch (error) {
    console.error("Erro ao excluir anotação:", error);
    alert("Erro ao excluir anotação.");
  }
}

/* --- Carregar arquivos de mídia para uma anotação --- */
async function loadMediaFiles(annotationId, container) {
  try {
    const files = await getMediaFilesByAnnotation(annotationId);
    
    if (files && files.length > 0) {
      const mediaSection = document.createElement('div');
      mediaSection.className = 'media-section';
      
      const mediaTitle = document.createElement('h4');
      mediaTitle.textContent = '📎 Arquivos Anexados:';
      mediaTitle.style.marginTop = '15px';
      mediaTitle.style.marginBottom = '10px';
      mediaSection.appendChild(mediaTitle);

      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'media-files-container';
      
      // Processar cada arquivo em sequencia
      for (const file of files) {
        const fileContainer = document.createElement('div');
        fileContainer.className = 'media-file-item';
        fileContainer.style.position = 'relative';
        fileContainer.style.marginBottom = '10px';
        
        // Aguardar a criação do preview 
        const preview = await createFilePreview(null, file);
        
        // Botão para deletar arquivo individual
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-media-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Excluir arquivo';
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          if (confirm(`Tem certeza que deseja excluir o arquivo "${file.fileName}"?`)) {
            const success = await deleteMediaFile(file.id);
            if (success) {
              fileContainer.remove();
              // remover a seção inteira se não houver mais arquivos
              if (mediaContainer.children.length === 0) {
                mediaSection.remove();
              }
            } else {
              alert('Erro ao excluir arquivo');
            }
          }
        };
        
        fileContainer.appendChild(preview);
        fileContainer.appendChild(deleteBtn);
        mediaContainer.appendChild(fileContainer);
      }

      mediaSection.appendChild(mediaContainer);
      container.appendChild(mediaSection);
    }
  } catch (error) {
    console.error('Erro ao carregar arquivos de mídia:', error);
  }
}

/* --- Configurar upload de arquivos no modal de edição --- */
function setupEditFileUpload() {
  const editFileInput = document.getElementById('editFileInput');
  const editPreviewContainer = document.getElementById('editFilePreviewContainer');

  if (!editFileInput || !editPreviewContainer) {
    console.warn('Elementos de upload do modal de edição não encontrados');
    return;
  }

  // Event listener para seleção de arquivos
  editFileInput.addEventListener('change', handleEditFileSelection);

  // Configurar drag and drop na seção de upload
  const uploadSection = document.getElementById('editUploadSection');
  if (uploadSection) {
    setupEditDragAndDrop(uploadSection, editFileInput);
  }
}

/* --- Configurar drag and drop para o modal de edição --- */
function setupEditDragAndDrop(uploadSection, fileInput) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadSection.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadSection.addEventListener(eventName, () => {
      uploadSection.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadSection.addEventListener(eventName, () => {
      uploadSection.classList.remove('drag-over');
    }, false);
  });

  uploadSection.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleEditFileSelection({ target: { files } });
  }, false);
}

/* --- Manipular seleção de arquivos no modal de edição --- */
async function handleEditFileSelection(event) {
  const files = Array.from(event.target.files);
  const previewContainer = document.getElementById('editFilePreviewContainer');
  
  if (!files.length) return;

  console.log(`Arquivos selecionados para edição: ${files.length}`);

  for (const file of files) {
    try {
      // Validar arquivo
      validateFile(file);
      
      // Adicionar à lista de arquivos selecionados
      editSelectedFiles.push(file);
      
      // Criar preview
      const previewItem = document.createElement('div');
      previewItem.className = 'file-preview-item';
      
      const preview = await createFilePreview(file);
      
      // Botão para remover arquivo da seleção
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-file-btn';
      removeBtn.innerHTML = '×';
      removeBtn.title = 'Remover arquivo';
      removeBtn.onclick = () => {
        // Remover da lista
        const index = editSelectedFiles.indexOf(file);
        if (index > -1) {
          editSelectedFiles.splice(index, 1);
        }
        // Remover preview
        previewItem.remove();
      };
      
      previewItem.appendChild(preview);
      previewItem.appendChild(removeBtn);
      previewContainer.appendChild(previewItem);
      
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      alert(`Erro no arquivo "${file.name}": ${error.message}`);
    }
  }
  
  // Limpar input para permitir selecionar os mesmos arquivos novamente
  event.target.value = '';
}

/* --- Fazer upload dos novos arquivos selecionados --- */
async function uploadEditSelectedFiles(annotationId) {
  if (editSelectedFiles.length === 0) {
    return true; // Nenhum arquivo para upload, sucesso
  }

  const progressDiv = document.getElementById('editUploadProgress');
  const statusElement = document.getElementById('editUploadStatus');
  const progressFill = document.getElementById('editProgressFill');

  try {
    progressDiv.style.display = 'block';
    let uploadedCount = 0;
    const totalFiles = editSelectedFiles.length;

    for (const file of editSelectedFiles) {
      try {
        statusElement.textContent = `Enviando ${file.name}... (${uploadedCount + 1}/${totalFiles})`;
        
        // Atualizar barra de progresso
        const progress = ((uploadedCount) / totalFiles) * 100;
        progressFill.style.width = `${progress}%`;

        // Fazer upload
        await uploadMediaFile(annotationId, file);
        uploadedCount++;
        
        console.log(`Arquivo ${file.name} enviado com sucesso`);

      } catch (error) {
        console.error(`Erro ao enviar ${file.name}:`, error);
        throw new Error(`Falha no upload de "${file.name}": ${error.message}`);
      }
    }

    // Upload completo
    progressFill.style.width = '100%';
    statusElement.textContent = `Upload concluído! ${uploadedCount} arquivo(s) enviado(s).`;
    
    // Limpar lista de arquivos selecionados
    editSelectedFiles = [];
    
    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressFill.style.width = '0%';
    }, 2000);

    return true;

  } catch (error) {
    console.error('Erro no upload:', error);
    statusElement.textContent = `Erro no upload: ${error.message}`;
    statusElement.style.color = '#dc3545';
    
    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressFill.style.width = '0%';
      statusElement.style.color = '';
    }, 5000);

    throw error;
  }
}

/* --- Limpar seleção de arquivos do modal --- */
function clearEditFileSelection() {
  editSelectedFiles = [];
  const previewContainer = document.getElementById('editFilePreviewContainer');
  if (previewContainer) {
    previewContainer.innerHTML = '';
  }
  
  const fileInput = document.getElementById('editFileInput');
  if (fileInput) {
    fileInput.value = '';
  }
  
  const progressDiv = document.getElementById('editUploadProgress');
  if (progressDiv) {
    progressDiv.style.display = 'none';
  }
}

/* --- Abrir modal de edição via API ------------ */
async function abrirEdicao(id) {
  try {
    const nota = await GETAnnotationById("http://localhost:5145/api/Annotation", id);

    if (!nota) {
      alert("Erro ao carregar anotação para edição.");
      return;
    }

    document.getElementById("editId").value = nota.id;
    document.getElementById("editTitle").value = nota.title;
    document.getElementById("editContent").value = nota.content;
    document.getElementById("editCategory").value = nota.category || "";
    document.getElementById("editReminder").value = nota.reminder
      ? new Date(nota.reminder).toISOString().slice(0, 16)
      : "";
    document.getElementById("editPriority").value = nota.priority;

    // Limpar arquivos selecionados anteriormente
    clearEditFileSelection();

    // Carregar arquivos de mídia no modal
    const editMediaContainer = document.getElementById("editMediaContainer");
    if (editMediaContainer) {
      editMediaContainer.innerHTML = '';
      await loadMediaFiles(nota.id, editMediaContainer);
    }

    const modal = document.getElementById("editModal");
    modal.classList.remove("hidden");
    modal.classList.add("open");

    // Configurar upload após abrir modal
    setupEditFileUpload();
    
  } catch (error) {
    console.error("Erro ao carregar anotação:", error);
    alert("Erro ao carregar anotação para edição.");
  }
}

/* --- Fechar modal de edição */
function fecharModal() {
  const modal = document.getElementById("editModal");
  const content = modal.querySelector(".modal-content");

  // Limpar seleção de arquivos ao fechar
  clearEditFileSelection();

  modal.classList.add("closing");

  content.addEventListener(
    "animationend",
    () => {
      modal.classList.add("hidden");
      modal.classList.remove("open", "closing");
    },
    { once: true }
  );
}

/* --- Realizar LOGOUT */
function logout() {
  if (confirm('Tem certeza que deseja sair?')) {
    authService.logout();
  }
}

window.logout = logout;

/* ========================================================
   Fluxo principal
======================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  // Verificar autenticação
  if (!authService.requireAuth()) {
    return;
  }

  // Realizar LOGOUT (registrado antes de carregar as notas, para funcionar mesmo sem anotações)
  document.getElementById("logoutButton").addEventListener("click", logout);

  const user = authService.getUser();
  const notesContainer = document.getElementById("notesContainer");

  try {
    const user = authService.getUser();

    if (!user || !user.id) {
      alert("Erro: usuário não autenticado. Faça login novamente.");
      authService.logout();
      return;
    }

    const userId = user.id;

    const apiData = await GETAnnotationsByUserId("http://localhost:5145/api/Annotation", userId);

    let anotacoes = [];

    if (apiData) {
      // Verificar se é um array que contem $values
      anotacoes = apiData.$values || apiData || [];
    }

    /* ---------- Renderização inicial ---------- */
    if (anotacoes.length === 0) {
      notesContainer.innerHTML = "<p>Nenhuma anotação cadastrada ainda.</p>";
      return;
    }

    // Ordenar por prioridade (alta para baixa)
    anotacoes.sort((a, b) => b.priority - a.priority);

    // Processar cada anotação
    for (const nota of anotacoes) {
      const div = document.createElement("div");
      div.className = "note";
      div.dataset.priority = nota.priority;

      const priorityText = {
        1: 'Baixa',
        2: 'Média',
        3: 'Alta'
      };

      div.innerHTML = `
        <h3>${nota.title}</h3>
        <p>${nota.content}</p>
        <p><strong>Categoria:</strong> ${nota.category || "Nenhuma"}</p>
        <p><strong>Prioridade:</strong> <span class="priority-${nota.priority}">${priorityText[nota.priority] || 'Não definida'}</span></p>
        ${nota.reminder
          ? `<p><strong>Lembrete:</strong> ${new Date(nota.reminder).toLocaleString('pt-BR')}</p>`
          : ""
        }
        <div class="note-actions">
          <button class="edit-btn" data-id="${nota.id}">Editar</button>
          <button class="delete-btn" data-id="${nota.id}">Excluir</button>
        </div>
      `;
      
      // Carregar arquivos de mídia para anotação
      await loadMediaFiles(nota.id, div);
      
      notesContainer.appendChild(div);
    }

    /* ---------- EXCLUIR / EDITAR ---------- */
    notesContainer.addEventListener("click", e => {
      const id = parseInt(e.target.dataset.id);
      if (e.target.classList.contains("delete-btn")) {
        excluirNota(id);
      }
      if (e.target.classList.contains("edit-btn")) {
        abrirEdicao(id);
      }
    });

    /* ---------- Cancelar edição ---------- */
    document.getElementById("cancelEdit").addEventListener("click", fecharModal);

    /* ---------- Salvar edição ---------- */
    document.getElementById("editForm").addEventListener("submit", async e => {
      e.preventDefault();

      const id = parseInt(document.getElementById("editId").value);
      const notaEditada = {
        id,
        title: document.getElementById("editTitle").value.trim(),
        content: document.getElementById("editContent").value.trim(),
        category: document.getElementById("editCategory").value.trim() || null,
        reminder: document.getElementById("editReminder").value || null,
        priority: parseInt(document.getElementById("editPriority").value),
        userId: userId
      };

      const submitButton = e.target.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Salvando...';

      try {
        // Primeiro, atualizar a anotação
        const updated = await PUTAnnotation("http://localhost:5145/api/Annotation", notaEditada);

        if (!updated) {
          throw new Error("Falha ao atualizar anotação");
        }

        // Depois, fazer upload dos novos arquivos (se houver)
        if (editSelectedFiles.length > 0) {
          submitButton.textContent = 'Enviando arquivos...';
          await uploadEditSelectedFiles(id);
        }

        alert("Anotação atualizada com sucesso!");
        fecharModal();
        location.reload();

      } catch (error) {
        console.error("Erro ao atualizar anotação:", error);
        alert(`Erro ao salvar alterações: ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });

  } catch (error) {
    console.error("Erro ao carregar anotações:", error);
    notesContainer.innerHTML = `<p>Erro ao carregar anotações. <button onclick="location.reload()">Tentar novamente</button></p>`;
  }
});