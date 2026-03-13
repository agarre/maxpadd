# Maximized Window Gap — KWin Script para Plasma 6

## Visão geral do projeto

KWin Script em JavaScript puro que adiciona padding configurável (em %) ao redor de janelas maximizadas no KDE Plasma 6 + Wayland.

**Nome do script:** `maxpadd`
**Linguagem:** JavaScript (ECMAScript — linguagem nativa do KWin Scripting)
**Target:** KDE Plasma 6.x, KWin 6.x, Wayland e X11
**Licença:** GPL-3.0

---

## Estrutura de arquivos

```
maxpadd/
├── contents/
│   ├── code/
│   │   └── main.js          ← Lógica principal
│   ├── config/
│   │   └── main.xml         ← Declaração das config keys
│   └── ui/
│       └── config.ui        ← Interface de configuração (Qt Designer XML)
├── metadata.json             ← Metadados do pacote KWin
├── LICENSE                   ← GPL-3.0
└── README.md                 ← Documentação
```

---

## Arquivo: metadata.json

```json
{
    "KPlugin": {
        "Id": "maxpadd",
        "Name": "Maximized Window Gap",
        "Description": "Adds configurable padding around maximized windows",
        "Authors": [
            {
                "Name": "Hugo Breda",
                "Email": "seu@email.com"
            }
        ],
        "Category": "Window Management",
        "License": "GPL-3.0",
        "Version": "1.0.0",
        "Website": "https://github.com/SEU_USER/maxpadd"
    },
    "X-Plasma-API": "javascript",
    "X-Plasma-MainScript": "contents/code/main.js",
    "X-KDE-ConfigModule": "kwin/effects/configs/kcm_kwin4_genericscripted"
}
```

**Notas:**
- `X-Plasma-API`: `javascript` para KWin Scripts (não `declarativescript` que é para QML)
- `Id`: deve ser o mesmo nome da pasta de instalação em `~/.local/share/kwin/scripts/`
- `X-KDE-ConfigModule`: habilita o botão de configuração (engrenagem) na tela de KWin Scripts

---

## Arquivo: contents/config/main.xml

Define as config keys e seus tipos/defaults. O KWin lê isso para saber quais configurações o script aceita.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kcfg xmlns="http://www.kde.org/standards/kcfg/1.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.kde.org/standards/kcfg/1.0
                          http://www.kde.org/standards/kcfg/1.0/kcfg.xsd">
    <kcfgfile name=""/>
    <group name="General">
        <entry name="gapPercent" type="Int">
            <default>90</default>
        </entry>
    </group>
</kcfg>
```

**Notas:**
- `name="gapPercent"` → é a key usada no `readConfig()` do JavaScript
- `type="Int"` → inteiro (porcentagem de 1 a 100)
- `<default>90</default>` → valor padrão: 90% da tela (10% de gap total)

---

## Arquivo: contents/ui/config.ui

Interface Qt Designer XML para a tela de configuração. Quando o usuário clica na engrenagem, aparece este formulário.

**Regras de binding:** O `objectName` de cada widget deve ser `kcfg_` + nome da config key. Ex: `kcfg_gapPercent`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ui version="4.0">
    <class>MaximizedWindowGapConfig</class>
    <widget class="QWidget" name="MaximizedWindowGapConfig">
        <layout class="QFormLayout" name="formLayout">
            <item row="0" column="0">
                <widget class="QLabel" name="labelGap">
                    <property name="text">
                        <string>Window size (% of screen):</string>
                    </property>
                </widget>
            </item>
            <item row="0" column="1">
                <widget class="QSpinBox" name="kcfg_gapPercent">
                    <property name="minimum">
                        <number>50</number>
                    </property>
                    <property name="maximum">
                        <number>100</number>
                    </property>
                    <property name="value">
                        <number>90</number>
                    </property>
                    <property name="suffix">
                        <string> %</string>
                    </property>
                </widget>
            </item>
        </layout>
    </widget>
</ui>
```

**Notas:**
- `kcfg_gapPercent` → KWin faz o binding automático com a key `gapPercent` do main.xml
- SpinBox com range 50-100%, sufixo " %"
- Sem botões extras, sem complexidade — uma única opção

---

## Arquivo: contents/code/main.js

### API do KWin 6 relevante

**Objetos globais disponíveis:**
- `workspace` → acesso ao gerenciador de janelas
- `readConfig(key, defaultValue)` → lê configuração do script

**Sinais importantes:**
- `workspace.windowAdded(window)` → janela nova criada
- `window.maximizedChanged()` → sinal PER-WINDOW quando estado maximizado muda (Plasma 6)
- `window.frameGeometryChanged` → quando geometria muda

**Propriedades da Window relevantes:**
- `window.normalWindow` → boolean, true se é janela normal (não painel, não dialog)
- `window.frameGeometry` → QRectF {x, y, width, height} — leitura e escrita
- `window.output` → tela onde a janela está

**Métodos do workspace:**
- `workspace.clientArea(option, window)` → retorna QRectF da área disponível
  - `KWin.MaximizeArea` → área maximizável (exclui painéis)

### Lógica do script

```
1. Ler config: gapPercent (default 90)
2. Para cada janela existente + novas:
   a. Conectar ao sinal de mudança de maximização
   b. Quando maximizar (h=true, v=true):
      - Obter área maximizável da tela: workspace.clientArea(KWin.MaximizeArea, window)
      - Calcular nova geometria: centralizar a janela com (gapPercent)% da área
      - Aplicar: window.frameGeometry = Qt.rect(x, y, w, h)
   c. Quando restaurar: não fazer nada (KWin restaura sozinho)
```

### Cuidados importantes

1. **Filtrar janelas:** Só aplicar em `window.normalWindow === true`. Ignorar painéis, dialogs, splash screens.
2. **Loop infinito:** Mudar `frameGeometry` pode re-triggerar `frameGeometryChanged`. Usar flag ou timer para evitar recursão.
3. **Multi-monitor:** `workspace.clientArea()` já retorna a área correta por tela quando passamos a window.
4. **Wayland:** A API `frameGeometry` funciona em Wayland no Plasma 6. Não usar APIs X11-only.
5. **Unmaximize:** Ao setar frameGeometry de uma janela maximizada, o KWin pode automaticamente "unmaximize" ela visualmente. Essa é a abordagem que o Maximized Window Gap original usa — interceptar a maximização, redimensionar, e a janela fica "quase-maximizada" mas tecnicamente restaurada.

### Abordagem alternativa (mais robusta)

Em vez de ouvir maximizedChanged e redimensionar, pode-se:
1. Ouvir `windowMaximizedStateChanged` no workspace (Plasma 5 style) ou conectar per-window
2. Imediatamente após maximizar, setar a geometria para a área com gap
3. O KWin vai "des-maximizar" a janela automaticamente porque o tamanho não bate com a área máxima

Isso é intencional — a janela fica posicionada como se estivesse maximizada, com gap, mas internamente o KWin a considera "restored".

---

## Instalação para desenvolvimento

### Método 1: Symlink (recomendado durante dev)

```bash
mkdir -p ~/.local/share/kwin/scripts/
ln -s /caminho/do/projeto/maxpadd \
      ~/.local/share/kwin/scripts/maxpadd
```

### Método 2: kpackagetool6

```bash
kpackagetool6 --type=KWin/Script -i ./maxpadd/
```

### Ativar o script

```bash
kwriteconfig6 --file kwinrc --group Plugins --key maxpaddEnabled true
qdbus6 org.kde.KWin /KWin reconfigure
```

Ou via: System Settings → Window Management → KWin Scripts → checkbox

### Recarregar após mudanças

```bash
qdbus6 org.kde.KWin /KWin reconfigure
```

Se não surtir efeito: desativar checkbox → Apply → reativar → Apply.

---

## Testes

### Scripting Console (testes rápidos)

Alt+F2 → digitar `wm console` → colar código JS → executar.

**Atenção:** Scripts executados via console NÃO persistem entre sessões. Servem apenas para testes.

### Logs de debug

```bash
# Habilitar logs do KWin Scripting
export QT_LOGGING_RULES="kwin_*.debug=true"

# Ver logs em tempo real (Wayland)
journalctl _COMM=kwin_wayland -f
```

Também: abrir `kdebugsettings` e ativar "KWin Scripting" em Full Debug.

### Checklist de testes

- [ ] Maximizar janela → gap aparece
- [ ] Restaurar janela → volta ao tamanho normal
- [ ] Mudar % na config → gap muda após reconfigure
- [ ] Testar em ambos os monitores
- [ ] Testar com janela que tem tamanho mínimo (ex: System Settings)
- [ ] Testar com tela cheia (F11) — NÃO deve aplicar gap em fullscreen
- [ ] Maximizar via atalho (Meta+Up) e via double-click na title bar
- [ ] Abrir janela já maximizada (ex: apps que lembram estado)

---

## Publicação

### KDE Store

1. Zipar a pasta: `cd maxpadd && zip -r ../maxpadd.kwinscript .`
2. Upload em: https://store.kde.org → Linux/Unix Desktops → Window Managers → KWin → KWin scripts

### AUR (Arch Linux)

Criar PKGBUILD:

```bash
pkgname=kwin-scripts-maxpadd
pkgver=1.0.0
pkgrel=1
pkgdesc="Adds configurable padding around maximized windows (Plasma 6)"
arch=('any')
url="https://github.com/SEU_USER/maxpadd"
license=('GPL-3.0-only')
depends=('kwin')
source=("$pkgname-$pkgver.tar.gz::$url/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')

package() {
    cd "maxpadd-$pkgver"
    install -dm755 "$pkgdir/usr/share/kwin/scripts/maxpadd"
    cp -r contents metadata.json LICENSE \
        "$pkgdir/usr/share/kwin/scripts/maxpadd/"
}
```

---

## Referências

- KWin Scripting Tutorial: https://develop.kde.org/docs/plasma/kwin/
- KWin Scripting API (KWin 6.0): https://develop.kde.org/docs/plasma/kwin/api/
- KDE Widget Config: https://develop.kde.org/docs/plasma/widget/configuration/
- Exemplo de config.ui com SpinBox: https://zren.github.io/kde/docs/widget/
- KWin repo (scripts inclusos): https://invent.kde.org/plasma/kwin
