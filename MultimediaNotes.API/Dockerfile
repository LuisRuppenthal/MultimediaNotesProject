FROM mcr.microsoft.com/dotnet/sdk:9.0

WORKDIR /app

# Instalar ferramentas do Entity Framework
RUN dotnet tool install --global dotnet-ef
ENV PATH="$PATH:/root/.dotnet/tools"

COPY ["MultimediaNotes.API.csproj", "./"]
RUN dotnet restore "MultimediaNotes.API.csproj"

COPY . .

RUN dotnet build "MultimediaNotes.API.csproj" -c Release -o /app/build
RUN dotnet publish "MultimediaNotes.API.csproj" -c Release -o /app/publish

ENV ASPNETCORE_ENVIRONMENT=Development
ENV ASPNETCORE_URLS=http://+:8080;https://+:8081

EXPOSE 8080
EXPOSE 8081
EXPOSE 5145

# Somente para debugar EF Tools
RUN dotnet ef --version

CMD ["dotnet", "/app/publish/MultimediaNotes.API.dll"]